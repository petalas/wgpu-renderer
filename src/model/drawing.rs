use rand::Rng;
use serde::{Deserialize, Serialize};
use wasm_bindgen::JsValue;
use web_sys::CanvasRenderingContext2d;

use crate::{util::Timer, Vertex};

use super::{
    polygon::Polygon,
    settings::{
        ADD_POLYGON_PROB, DEBUG_TIMERS, MAX_POLYGONS_PER_IMAGE, MIN_POLYGONS_PER_IMAGE,
        REMOVE_POLYGON_PROB, REORDER_POLYGON_PROB, START_WITH_POLYGONS_PER_IMAGE,
    },
};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Drawing {
    pub polygons: Vec<Polygon>,
    pub is_dirty: bool,
    pub fitness: f32,
}

impl Drawing {
    pub fn draw(&self, ctx: &CanvasRenderingContext2d, return_image_data: bool) -> Option<Vec<u8>> {
        let _timer: Timer; // scope determines lifetime (time_end on destruction) -> can't be inside the if statement
        if DEBUG_TIMERS {
            _timer = Timer::new("Drawing::draw");
        }
        let w = f64::from(ctx.canvas().unwrap().width());
        let h = f64::from(ctx.canvas().unwrap().height());

        ctx.set_fill_style(&JsValue::from("#fff"));
        ctx.fill_rect(0.0, 0.0, w, h);

        /* draw the polygons */
        for polygon in &self.polygons {
            /* Draw the starting vertex */
            ctx.begin_path();
            ctx.move_to(polygon.points[0].x as f64 * w, polygon.points[0].y as f64 * h);

            /* Create the rest of the vertices sequentially */
            for i in 0..polygon.points.len() {
                ctx.line_to(polygon.points[i].x as f64 * w, polygon.points[i].y as f64  * h);
            }
            ctx.close_path();

            let c = &polygon.color;
            let color = format!("rgba({},{},{},{})", c.r, c.g, c.b, c.a as f32 / 255.0);
            ctx.set_fill_style(&JsValue::from(color));
            ctx.fill();
        }

        // get_image_data is very slow so we want to avoid it whenever possible
        // only return the pixel values when we need them for fitness calculations
        if !return_image_data {
            return None;
        }
        return Some(ctx.get_image_data(0.0, 0.0, w, h).unwrap().data().to_vec());
    }

    pub fn num_points(&self) -> usize {
        self.polygons
            .iter()
            .fold(0, |sum, polygon| sum + polygon.num_points())
    }

    pub fn new_random() -> Drawing {
        Drawing {
            polygons: (0..START_WITH_POLYGONS_PER_IMAGE)
                .map(|_| Polygon::new_random())
                .collect(),
            is_dirty: true,
            fitness: 0.0,
        }
    }

    pub fn mutate(&mut self) {
        if rand::thread_rng().gen::<f32>() < ADD_POLYGON_PROB {
            if self.add_polygon() {
                self.is_dirty = true;
            }
        }

        if rand::thread_rng().gen::<f32>() < REMOVE_POLYGON_PROB {
            if self.remove_polygon() {
                self.is_dirty = true;
            }
        }

        if rand::thread_rng().gen::<f32>() < REORDER_POLYGON_PROB {
            if self.reorder_polygons() {
                self.is_dirty = true;
            }
        }

        let mut internal_mutation_happened = false;
        self.polygons.iter_mut().for_each(|p| {
            internal_mutation_happened = p.mutate();
        });

        if internal_mutation_happened {
            self.is_dirty = true;
        }
    }

    pub fn add_polygon(&mut self) -> bool {
        if self.polygons.len() >= MAX_POLYGONS_PER_IMAGE {
            return false;
        }
        let polygon = Polygon::new_random();
        let index = rand::thread_rng().gen_range(0..self.polygons.len() - 1);
        self.polygons.insert(index, polygon);
        return true;
    }

    pub fn remove_polygon(&mut self) -> bool {
        if self.polygons.len() < 1 {
            return false;
        }
        if self.polygons.len() <= MIN_POLYGONS_PER_IMAGE {
            return false;
        }
        let index = rand::thread_rng().gen_range(0..self.polygons.len() - 1);
        self.polygons.remove(index);
        return true;
    }

    pub fn reorder_polygons(&mut self) -> bool {
        let l = self.polygons.len();
        if self.polygons.len() < 2 {
            return false;
        }
        let i1 = rand::thread_rng().gen_range(0..l - 1);
        let mut i2 = rand::thread_rng().gen_range(0..l - 1);
        while i1 == i2 {
            i2 = rand::thread_rng().gen_range(0..l - 1);
        }
        self.polygons.swap(i1, i2);
        return true;
    }

    pub fn to_vertices(&self) -> Vec<Vertex> {
        self.clone()
            .polygons
            .into_iter()
            .map(|pp| {
                let arr: Vec<Vertex> = pp
                    .points
                    .into_iter()
                    .map(|p| Vertex {
                        position: [scale(p.x), scale(1.0 - p.y), 0.0f32, 1.0f32],
                        color: [
                            pp.color.r as f32 / 255.0,
                            pp.color.g as f32 / 255.0,
                            pp.color.b as f32 / 255.0,
                            pp.color.a as f32 / 255.0,
                        ],
                    })
                    .collect();
                arr
            })
            .flatten()
            .collect()
    }
}

impl From<JsValue> for Drawing {
    fn from(value: JsValue) -> Self {
        let stringified = JsValue::as_string(&value).expect("Expected stringified Drawing.");
        Drawing::from(stringified)
    }
}

impl From<String> for Drawing {
    fn from(json: String) -> Self {
        serde_json::from_str(&json).expect(&format!("Expected deserializable Drawing.\n{}", json))
    }
}

fn scale(number: f32) -> f32 {
    return number * 2.0 - 1.0;
}
