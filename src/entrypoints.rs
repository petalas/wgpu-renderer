use wasm_bindgen::{prelude::wasm_bindgen, JsCast, JsValue};

use crate::{model::drawing::Drawing, util::get_canvas_by_id};

#[wasm_bindgen(start)]
pub async fn main() {
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));
    console_log::init_with_level(log::Level::Debug).expect("could not initialize logger");
}

#[wasm_bindgen()]
pub fn draw_without_gpu(drawing_json: JsValue, canvas_id: &str) -> Vec<u8> {
    let canvas = get_canvas_by_id(canvas_id);

    let ctx = canvas
        .get_context("2d")
        .unwrap()
        .unwrap()
        .dyn_into::<web_sys::CanvasRenderingContext2d>()
        .unwrap();

    Drawing::from(drawing_json).draw(&ctx, true).unwrap()
}
