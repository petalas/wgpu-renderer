use rand::Rng;
use serde::{Deserialize, Serialize};
use wasm_bindgen::JsValue;
use web_sys::CanvasRenderingContext2d;

use crate::util::Timer;

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
    polygons: Vec<Polygon>,
    is_dirty: bool,
    fitness: f64,
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
            ctx.move_to(polygon.points[0].x * w, polygon.points[0].y * h);

            /* Create the rest of the vertices sequentially */
            for i in 0..polygon.points.len() {
                ctx.line_to(polygon.points[i].x * w, polygon.points[i].y * h);
            }
            ctx.close_path();

            let c = &polygon.color;
            let color = format!("rgba({},{},{},{})", c.r, c.g, c.b, c.a as f64 / 255.0);
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

    fn num_points(&self) -> usize {
        self.polygons
            .iter()
            .fold(0, |sum, polygon| sum + polygon.num_points())
    }

    fn new_random() -> Drawing {
        Drawing {
            polygons: (0..START_WITH_POLYGONS_PER_IMAGE)
                .map(|_| Polygon::new_random())
                .collect(),
            is_dirty: true,
            fitness: 0.0,
        }
    }

    fn mutate(&mut self) {
        if rand::thread_rng().gen::<f64>() < ADD_POLYGON_PROB {
            if self.add_polygon() {
                self.is_dirty = true;
            }
        }

        if rand::thread_rng().gen::<f64>() < REMOVE_POLYGON_PROB {
            if self.remove_polygon() {
                self.is_dirty = true;
            }
        }

        if rand::thread_rng().gen::<f64>() < REORDER_POLYGON_PROB {
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

    fn add_polygon(&mut self) -> bool {
        if self.polygons.len() >= MAX_POLYGONS_PER_IMAGE {
            return false;
        }
        let polygon = Polygon::new_random();
        let index = rand::thread_rng().gen_range(0..self.polygons.len() - 1);
        self.polygons.insert(index, polygon);
        return true;
    }

    fn remove_polygon(&mut self) -> bool {
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

    fn reorder_polygons(&mut self) -> bool {
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
