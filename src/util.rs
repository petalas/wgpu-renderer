use wasm_bindgen::{prelude::wasm_bindgen, JsCast};
use web_sys::{console, CanvasRenderingContext2d, Element, HtmlCanvasElement, ImageData};

use crate::{model::drawing::Drawing, run};
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
pub fn draw(canvas: wasm_bindgen::JsValue, drawing_json: wasm_bindgen::JsValue) {
    let canvas = canvas
        .dyn_into::<HtmlCanvasElement>()
        .expect("Not an HTML Canvas");

    let ctx = canvas
        .get_context("2d")
        .unwrap()
        .unwrap()
        .dyn_into::<web_sys::CanvasRenderingContext2d>()
        .unwrap();

    let data = Drawing::from(drawing_json).draw(&ctx, true).unwrap();
    log::info!("canvas bytes: {:?}", data.len());
}

#[wasm_bindgen()]
pub fn draw_gpu(drawing_json: wasm_bindgen::JsValue) {
    let drawing = Drawing::from(drawing_json);
    wasm_bindgen_futures::spawn_local(run(drawing));
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
