use std::mem::size_of;

use log::info;
use wasm_bindgen::JsCast;
use web_sys::{CanvasRenderingContext2d, Element, HtmlCanvasElement, ImageData};

use rand::Rng;

use crate::model::settings::MAX_ERROR_PER_PIXEL;

pub struct Timer<'a> {
    name: &'a str,
}

impl<'a> Timer<'a> {
    pub fn new(name: &'a str) -> Timer<'a> {
        web_sys::console::time_with_label(name);
        Timer { name }
    }
}

impl<'a> Drop for Timer<'a> {
    fn drop(&mut self) {
        web_sys::console::time_end_with_label(self.name);
    }
}

pub fn get_context(canvas: &HtmlCanvasElement) -> CanvasRenderingContext2d {
    let opts = js_sys::Object::new();
    js_sys::Reflect::set(&opts, &"willReadFrequently".into(), &true.into()).unwrap();

    canvas
        .get_context_with_context_options("2d", &opts)
        .unwrap()
        .unwrap()
        .dyn_into::<web_sys::CanvasRenderingContext2d>()
        .unwrap()
}

pub fn draw_buffer(buffer: &Vec<u8>, canvas: &HtmlCanvasElement) {
    let w = canvas.width() as usize;
    let h = canvas.height() as usize;
    let ctx = get_context(&canvas);

    let clamped: wasm_bindgen::Clamped<&[u8]>;
    let mut actual_data = vec![];
    if buffer.len() == w * h * 4 {
        // no padding has been added, can use directly
        clamped = wasm_bindgen::Clamped(&buffer);
    } else {
        // copy out our actual data and ignore the padding that has been added to the gpu buffer
        let bd = BufferDimensions::new(w, h);
        actual_data.reserve(bd.unpadded_bytes_per_row * h as usize);
        for i in 0..h {
            let start_index = (i * bd.padded_bytes_per_row) as usize;
            let end_index = start_index + bd.unpadded_bytes_per_row;
            actual_data.extend_from_slice(&buffer[start_index..end_index]);
        }
        clamped = wasm_bindgen::Clamped(&actual_data);
    }

    let image_data =
        ImageData::new_with_u8_clamped_array_and_sh(clamped, w as u32, h as u32).unwrap();
    ctx.put_image_data(&image_data, 0.0, 0.0).unwrap();
}

pub fn get_element(id: &str) -> Element {
    let window = web_sys::window().expect("global window does not exists");
    let document = window.document().expect("expecting a document on window");
    //let body = document.body().expect("document expect to have have a body");
    let element = document.get_element_by_id(id).unwrap();

    element
}

pub fn get_canvas_by_id(id: &str) -> HtmlCanvasElement {
    let element = get_element(&id);
    return element.dyn_into::<HtmlCanvasElement>().unwrap();
}

pub async fn draw_on_canvas_internal(bytes: &Vec<u8>, canvas_id: &str) {
    let canvas = get_canvas_by_id(&canvas_id);
    draw_buffer(&bytes, &canvas);
}

// TODO: double check this logic.
// we have read the error_buffer straight out of the gpu as raw bytes
// it was actually f32 values in the -1..1 range (could add abs() and have 0..1)
// so first we convert each 4 bytes back to f32 then multiply by 255 to scale to -255..255 range
// each f32 is the error between the drawing bytes and the source bytes (diff)
pub fn calculate_error_from_gpu(error_buffer: &Vec<u8>) -> (f64, Vec<u8>) {
    let error_buffer_f32: Vec<f32> = error_buffer
        .chunks_exact(4)
        .map(|c| f32::from_ne_bytes(c.try_into().unwrap()) * 255.0)
        .collect();

    let mut error_heatmap: Vec<u8> = Vec::with_capacity(error_buffer_f32.len());
    let mut error: f64 = 0.0;
    error_buffer_f32.chunks_exact(4).for_each(|c| {
        let re = c[0];
        let ge = c[1];
        let be = c[2];
        // let ae = c[3]; // alpha ignored

        let sqrt = f64::sqrt(((re * re) + (ge * ge) + (be * be)) as f64);
        error += sqrt;

        let err_color = f64::floor(255.0 * (1.0 - sqrt / MAX_ERROR_PER_PIXEL)) as u8;
        error_heatmap.extend_from_slice(&[255, err_color, err_color, 255]);
    });

    return (error, error_heatmap);
}

pub fn check_error_calcs(
    source_bytes: &Vec<u8>,
    drawing_bytes: &Vec<u8>,
    error_bytes_f32: &Vec<f32>,
) {
    assert_eq!(source_bytes.len(), drawing_bytes.len());
    assert_eq!(source_bytes.len(), error_bytes_f32.len());

    let mut error1 = 0.0;
    let num_pixels = source_bytes.len() / 4;
    for i in 0..num_pixels {
        let r = (i * 4) as usize;
        let g = r + 1;
        let b = g + 1;
        // let a = b + 1; // don't need to involve alpha in error calc

        // can't subtract u8 from u8 -> potential underflow
        let re = drawing_bytes[r] as isize - source_bytes[r] as isize;
        let ge = drawing_bytes[g] as isize - source_bytes[g] as isize;
        let be = drawing_bytes[b] as isize - source_bytes[b] as isize;

        error1 += f64::sqrt(((re * re) + (ge * ge) + (be * be)) as f64);
    }

    let error2: f64 = error_bytes_f32
        .chunks_exact(4)
        .map(|c| {
            let re = c[0];
            let ge = c[1];
            let be = c[2];
            // let ae = c[3]; // alpha ignored
            f64::sqrt(((re * re) + (ge * ge) + (be * be)) as f64)
        })
        .sum();

    log::info!("{} vs {}", error1, error2);
}

pub fn randomf64_clamped(min: f64, max: f64) -> f64 {
    return rand::thread_rng().gen_range(min..max);
}

pub fn randomf32_clamped(min: f32, max: f32) -> f32 {
    return rand::thread_rng().gen_range(min..max);
}

pub async fn get_bytes(output_buffer: &wgpu::Buffer) -> Vec<u8> {
    let buffer_slice = output_buffer.slice(..);

    // Sets the buffer up for mapping, sending over the result of the mapping back to us when it is finished.
    let (sender, receiver) = futures_intrusive::channel::shared::oneshot_channel();
    buffer_slice.map_async(wgpu::MapMode::Read, move |v| sender.send(v).unwrap());

    if let Some(Ok(())) = receiver.receive().await {
        let padded_buffer = buffer_slice.get_mapped_range();
        let vec = padded_buffer.to_vec();
        drop(padded_buffer); // avoid --> "You cannot unmap a buffer that still has accessible mapped views."
        output_buffer.unmap(); // avoid --> Buffer ObjectId { id: Some(1) } is already mapped' (breaks looping logic)
        return vec;
    } else {
        output_buffer.unmap(); // probably makes no difference but just to be safe
        return vec![];
    }
}

pub struct BufferDimensions {
    pub width: usize,
    pub height: usize,
    pub unpadded_bytes_per_row: usize,
    pub padded_bytes_per_row: usize,
}

impl BufferDimensions {
    pub fn new(width: usize, height: usize) -> Self {
        let bytes_per_pixel = size_of::<u32>();
        let unpadded_bytes_per_row = width * bytes_per_pixel;
        let align = wgpu::COPY_BYTES_PER_ROW_ALIGNMENT as usize;
        let padded_bytes_per_row_padding = (align - unpadded_bytes_per_row % align) % align;
        let padded_bytes_per_row = unpadded_bytes_per_row + padded_bytes_per_row_padding;
        Self {
            width,
            height,
            unpadded_bytes_per_row,
            padded_bytes_per_row,
        }
    }
}
