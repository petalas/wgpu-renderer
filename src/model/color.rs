use rand::Rng;
use serde::{Deserialize, Serialize};

use super::settings::{
    CHANGE_COLOR_PROB, DARKEN_COLOR_PROB, LIGHTEN_COLOR_PROB, MAX_ALPHA,
    MICRO_ADJUSTMENT_PROBABILITY, MIN_ALPHA,
};

#[derive(Serialize, Deserialize, Debug, Clone, Copy)]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

impl Color {
    pub fn new_random() -> Color {
        Color {
            r: rand::thread_rng().gen::<u8>(),
            g: rand::thread_rng().gen::<u8>(),
            b: rand::thread_rng().gen::<u8>(),
            a: rand::thread_rng().gen::<u8>().clamp(MIN_ALPHA, MAX_ALPHA),
        }
    }

    pub fn mutate(&mut self) -> bool {
        let mut mutation_happened = false;

        if rand::thread_rng().gen::<f32>() < CHANGE_COLOR_PROB {
            self.r = rand::thread_rng().gen::<u8>();
            mutation_happened = true;
        }
        if rand::thread_rng().gen::<f32>() < CHANGE_COLOR_PROB {
            self.g = rand::thread_rng().gen::<u8>();
            mutation_happened = true;
        }
        if rand::thread_rng().gen::<f32>() < CHANGE_COLOR_PROB {
            self.b = rand::thread_rng().gen::<u8>();
            mutation_happened = true;
        }
        if rand::thread_rng().gen::<f32>() < CHANGE_COLOR_PROB {
            self.a = rand::thread_rng().gen::<u8>().clamp(MIN_ALPHA, MAX_ALPHA);
            mutation_happened = true;
        }

        //// same but micro adjustments
        if rand::thread_rng().gen::<f32>() < MICRO_ADJUSTMENT_PROBABILITY {
            self.r = Color::micro_adjust(self.r);
            mutation_happened = true;
        }
        if rand::thread_rng().gen::<f32>() < MICRO_ADJUSTMENT_PROBABILITY {
            self.g = Color::micro_adjust(self.g);
            mutation_happened = true;
        }
        if rand::thread_rng().gen::<f32>() < MICRO_ADJUSTMENT_PROBABILITY {
            self.b = Color::micro_adjust(self.b);
            mutation_happened = true;
        }
        if rand::thread_rng().gen::<f32>() < MICRO_ADJUSTMENT_PROBABILITY {
            self.a = Color::micro_adjust(self.a).clamp(MIN_ALPHA, MAX_ALPHA);
            mutation_happened = true;
        }
        ////
        if rand::thread_rng().gen::<f32>() < LIGHTEN_COLOR_PROB {
            if self.r < u8::MAX && self.g < u8::MAX && self.b < u8::MAX {
                self.r += 1;
                self.g += 1;
                self.b += 1;
                mutation_happened = true;
            }
        }
        if rand::thread_rng().gen::<f32>() < DARKEN_COLOR_PROB {
            if self.r > u8::MIN && self.g > u8::MIN && self.b > u8::MIN {
                self.r -= 1;
                self.g -= 1;
                self.b -= 1;
                mutation_happened = true;
            }
        }

        mutation_happened
    }

    // increment or decrement with 50% chance while avoiding overflows and underflows
    fn micro_adjust(mut val: u8) -> u8 {
        val = if rand::thread_rng().gen::<f32>() > 0.5 {
            if val < u8::MAX {
                val + 1
            } else {
                val - 1
            }
        } else {
            if val > u8::MIN {
                val - 1
            } else {
                val + 1
            }
        };
        val
    }
}
