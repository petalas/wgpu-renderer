use rand::Rng;
use serde::{Deserialize, Serialize};

use crate::util::randomf32_clamped;

use super::settings::{
    MICRO_ADJUSTMENT_DELTA, MICRO_ADJUSTMENT_PROBABILITY, MOVE_POINT_MAX_DELTA,
    MOVE_POINT_PROBABILITY,
};

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, PartialOrd)]
pub struct Point {
    pub x: f32,
    pub y: f32,
}

impl Point {
    pub fn new_random() -> Point {
        Point {
            x: rand::thread_rng().gen::<f32>(),
            y: rand::thread_rng().gen::<f32>(),
        }
    }

    pub fn offset(&mut self, x_offset: f32, y_offset: f32) {
        self.x = (self.x + x_offset).clamp(0.0, 1.0);
        self.y = (self.y + y_offset).clamp(0.0, 1.0);
    }

    pub fn mutate(&mut self) -> bool {
        let mut mutated = false;
        if rand::thread_rng().gen::<f32>() < MOVE_POINT_PROBABILITY {
            let d = MOVE_POINT_MAX_DELTA;
            self.x = randomf32_clamped(self.x - d, self.x + d).clamp(0.0, 1.0);
            self.y = randomf32_clamped(self.y - d, self.y + d).clamp(0.0, 1.0);
            mutated = true;
        }

        if rand::thread_rng().gen::<f32>() < MICRO_ADJUSTMENT_PROBABILITY {
            let d = MICRO_ADJUSTMENT_DELTA;
            self.x = randomf32_clamped(self.x - d, self.x + d).clamp(0.0, 1.0);
            self.y = randomf32_clamped(self.y - d, self.y + d).clamp(0.0, 1.0);
            mutated = true;
        }
        mutated
    }
}

impl Eq for Point {}

impl Ord for Point {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        if self.x < other.x {
            return std::cmp::Ordering::Less;
        }
        if self.y < other.y {
            return std::cmp::Ordering::Less;
        }
        return std::cmp::Ordering::Equal;
    }
}
