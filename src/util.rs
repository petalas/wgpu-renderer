use wasm_bindgen::JsCast;
use web_sys::{CanvasRenderingContext2d, Element, HtmlCanvasElement, ImageData};

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
