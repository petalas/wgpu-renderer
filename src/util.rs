use std::mem::size_of;

use log::info;
use wasm_bindgen::{prelude::wasm_bindgen, JsCast};
use web_sys::{
    console::{self},
    CanvasRenderingContext2d, Element, HtmlCanvasElement, HtmlImageElement, ImageData,
};

use crate::{
    model::{
        drawing::Drawing,
        settings::{MAX_ERROR_PER_PIXEL, PER_POINT_MULTIPLIER},
    },
    texture::Texture,
    Engine,
};
use rand::Rng;

pub struct Timer<'a> {
    name: &'a str,
}

impl<'a> Timer<'a> {
    pub fn new(name: &'a str) -> Timer<'a> {
        console::time_with_label(name);
        Timer { name }
    }
}

impl<'a> Drop for Timer<'a> {
    fn drop(&mut self) {
        console::time_end_with_label(self.name);
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
    let w = canvas.width();
    let ctx = get_context(&canvas);
    let data = ImageData::new_with_u8_clamped_array(wasm_bindgen::Clamped(&buffer), w).unwrap();
    ctx.put_image_data(&data, 0.0, 0.0).unwrap();
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

pub fn resize_canvas(canvas: &HtmlCanvasElement, w: u32, h: u32) {
    canvas.set_width(w);
    canvas.set_height(h);
}

#[wasm_bindgen()]
pub fn draw(
    canvas: wasm_bindgen::JsValue,
    drawing_json: wasm_bindgen::JsValue,
    width: usize,
    height: usize,
) {
    let canvas = canvas
        .dyn_into::<HtmlCanvasElement>()
        .expect("Not an HTML Canvas");

    resize_canvas(&canvas, width as u32, height as u32);

    let ctx = canvas
        .get_context("2d")
        .unwrap()
        .unwrap()
        .dyn_into::<web_sys::CanvasRenderingContext2d>()
        .unwrap();

    let data = Drawing::from(drawing_json).draw(&ctx, true).unwrap();
    info!("canvas bytes: {:?}", data.len());
}

#[wasm_bindgen()]
pub fn start_loop(
    drawing_json: wasm_bindgen::JsValue,
    width: usize,
    height: usize,
    source_bytes: Vec<u8>,
    n: usize,
) {
    // let drawing = Drawing::from(drawing_json);
    let drawing = Drawing::new_random(); // test starting from scratch
    wasm_bindgen_futures::spawn_local(loop_internal(drawing, width, height, source_bytes, n));
}

async fn loop_internal(
    mut drawing: Drawing,
    width: usize,
    height: usize,
    source_bytes: Vec<u8>,
    n: usize,
) {
    // let canvas = get_canvas_by_id("wgpu-canvas");
    let engine = &Engine::new(&source_bytes, width, height).await;

    // even if it was already set evaluate it again, could be coming in from a different rendering engine
    drawing.fitness = (evaluate_drawing(&drawing, engine, width, height).await).1;

    for i in 0..n {
        drawing = mutate_new_best(drawing, engine, width, height).await;
        log::info!("{} --> fitness = {}", i, drawing.fitness);
        // draw_buffer(&(get_bytes(&engine.drawing_output_buffer).await), &canvas);
        draw_on_canvas(get_bytes(&engine.drawing_output_buffer).await, width, height);
    }

    log::info!("Loop done (x{}), fitness = {}", n, drawing.fitness);
}

async fn mutate_new_best(
    mut drawing: Drawing,
    engine: &Engine,
    width: usize,
    height: usize,
) -> Drawing {
    let current_best = drawing.fitness;
    // let mut count = 0;
    // log::info!("Current fitness = {}", current_best);
    while drawing.fitness <= current_best {
        drawing.is_dirty = false;
        // count = 0;
        while !drawing.is_dirty {
            drawing.mutate();
            // count += 1;
        }
        // info!("took {} attempts to get a new mutation", count);
        drawing.fitness = (evaluate_drawing(&drawing, &engine, width, height).await).1;
    }
    // info!(
    //     "fitness improved from {} to {}",
    //     current_best,
    //     drawing.fitness
    // );
    drawing
}

async fn evaluate_drawing(
    drawing: &Drawing,
    engine: &Engine,
    width: usize,
    height: usize,
) -> (f64, f64) {
    // step 1 - render pipeline --> draw our triangles to a texture
    engine.draw(&drawing).await;

    // Step 2 - compute pipeline --> diff drawing texture vs source texture
    engine.calculate_error(width as u32, height as u32).await;

    // Step 3 - sum output of compute pipeline // TODO: reduction on GPU
    let error_bytes = get_bytes(&engine.error_output_buffer).await;
    let error = calculate_error_from_gpu(error_bytes);
    let max_total_error: f64 = MAX_ERROR_PER_PIXEL * width as f64 * height as f64;
    let mut fitness: f64 = 100.0 * (1.0 - error / max_total_error);
    let penalty = fitness * PER_POINT_MULTIPLIER * drawing.num_points() as f64;
    fitness -= penalty;
    // FIXME: figure out why we're getting completely different values than the non gpu version
    // log::info!(
    //     "error: {}, penalty: {}, fitness: {}",
    //     error,
    //     penalty,
    //     fitness
    // );
    (error, fitness)
}

#[wasm_bindgen()]
pub fn draw_gpu(
    drawing_json: wasm_bindgen::JsValue,
    width: usize,
    height: usize,
    source_bytes: Vec<u8>,
) {
    let drawing = Drawing::from(drawing_json);
    wasm_bindgen_futures::spawn_local(draw_gpu_internal(drawing, width, height, source_bytes));
}

async fn draw_gpu_internal(
    mut drawing: Drawing,
    width: usize,
    height: usize,
    source_bytes: Vec<u8>,
) {
    // draw on GPU and read output_buffer
    let engine = &Engine::new(&source_bytes, width, height).await;
    engine.draw(&drawing).await;

    let (error, fitness) = evaluate_drawing(&drawing, engine, width, height).await;
    drawing.fitness = fitness;
    log::info!("error = {}, fitness = {}", error, fitness);

    // getting the bytes this way seems to work, can draw on canvas
    let drawing_bytes = get_bytes(&engine.drawing_output_buffer).await;
    draw_on_canvas(drawing_bytes, width, height);
}

fn draw_on_canvas(drawing_bytes: Vec<u8>, width: usize, height: usize) {
    wasm_bindgen_futures::spawn_local(draw_on_canvas_internal(drawing_bytes, width, height));
}

async fn draw_on_canvas_internal(drawing_bytes: Vec<u8>, width: usize, height: usize) {
    // draw to HtmlCanvasElement
    let canvas = get_canvas_by_id("wgpu-canvas");
    resize_canvas(&canvas, width as u32, height as u32);
    draw_buffer(&drawing_bytes, &canvas);
}

pub fn calculate_error_from_gpu(error_bytes: Vec<u8>) -> f64 {
    let error_bytes_f32: Vec<f32> = error_bytes
        .chunks_exact(4)
        .map(|c| f32::from_ne_bytes(c.try_into().unwrap()) * 255.0)
        .collect();

    error_bytes_f32
        .chunks_exact(4)
        .map(|c| {
            let re = c[0];
            let ge = c[1];
            let be = c[2];
            // let ae = c[3]; // alpha ignored
            f64::sqrt(((re * re) + (ge * ge) + (be * be)) as f64)
        })
        .sum()
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

pub fn toArray<T, const N: usize>(v: Vec<T>) -> [T; N] {
    v.try_into()
        .unwrap_or_else(|v: Vec<T>| panic!("Expected a Vec of length {} but it was {}", N, v.len()))
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
