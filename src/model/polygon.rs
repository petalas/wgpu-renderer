use rand::Rng;
use serde::{Deserialize, Serialize};

use crate::util::randomf32_clamped;

use super::{
    color::Color,
    point::Point,
    settings::{
        MIN_POINTS_PER_POLYGON, NEW_POINT_MAX_DISTANCE, OFFSET_POLYGON_MAGNITUDE,
        OFFSET_POLYGON_PROBABILITY, REMOVE_POINT_PROBABILITY,
    },
};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Polygon {
    pub points: Vec<Point>,
    pub color: Color,
}

impl Polygon {
    pub fn num_points(&self) -> usize {
        self.points.len()
    }

    pub fn new_random() -> Polygon {
        let origin: Point = Point::new_random();
        let d = NEW_POINT_MAX_DISTANCE;
        let points = (0..3)
            .map(|_| {
                let x = randomf32_clamped(origin.x - d, origin.x + d).clamp(0.0, 1.0);
                let y = randomf32_clamped(origin.y - d, origin.y + d).clamp(0.0, 1.0);
                return Point { x, y };
            })
            .collect();
        Polygon {
            points,
            color: Color::new_random(),
        }
    }

    pub fn offset_polygon(&mut self) -> bool {
        if self.points.len() < 3 {
            return false;
        }

        let x_offset = randomf32_clamped(-OFFSET_POLYGON_MAGNITUDE, OFFSET_POLYGON_MAGNITUDE);
        let y_offset = randomf32_clamped(-OFFSET_POLYGON_MAGNITUDE, OFFSET_POLYGON_MAGNITUDE);
        self.points
            .iter_mut()
            .for_each(|point| point.offset(x_offset, y_offset));

        true
    }

    pub fn remove_point(&mut self) -> bool {
        let n = self.points.len();
        if n <= MIN_POINTS_PER_POLYGON {
            return false;
        }
        let i = rand::thread_rng().gen_range(0..(n - 1));
        self.points.remove(i);
        true
    }

    pub fn mutate(&mut self) -> bool {
        let mut mutated = false;
        if rand::thread_rng().gen::<f32>() < OFFSET_POLYGON_PROBABILITY {
            if self.offset_polygon() {
                mutated = true;
            }
        }
        if rand::thread_rng().gen::<f32>() < REMOVE_POINT_PROBABILITY {
            if self.remove_point() {
                mutated = true;
            }
        }

        if self.color.mutate() {
            mutated = true
        }

        self.points.iter_mut().for_each(|p| {
            if p.mutate() {
                mutated = true;
            }
        });

        mutated
    }
}
