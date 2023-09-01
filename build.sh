#!/bin/sh
set -ex

RUSTFLAGS=--cfg=web_sys_unstable_apis cargo build --release --target wasm32-unknown-unknown

wasm-bindgen target/wasm32-unknown-unknown/release/renderer.wasm --target web --out-dir=src/assets/wasm