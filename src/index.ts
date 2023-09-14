import no_background from "./assets/no_bg_128"; // a: 127 no background
import white_background from "./assets/white_bg_128"; // a: 127 white background

import { Engine, default as init } from "./assets/wasm/renderer";

import "./reset.css";
import "./styles.css";

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface Dimensions {
  w: number;
  h: number;
  original_width: number;
  original_height: number;
}

const initEngine = async (dimensions: Dimensions) => {
  const { w, h } = dimensions;
  const native = document.getElementById("native-canvas") as HTMLCanvasElement;
  const wgpu = document.getElementById("wgpu-canvas") as HTMLCanvasElement;
  native.width = w;
  native.height = h;
  wgpu.width = w;
  wgpu.height = h;
  await loadWasm();
  const engine = await createEngine(dimensions);
  await engine.test_canvas_vs_wgpu();
};

const createEngine = async (dimensions: Dimensions): Promise<Engine> => {
  const { w, h } = dimensions;
  const drawing = JSON.stringify(no_background);
  // const drawing = JSON.stringify(white_background);
  return Engine.new(new Uint8Array(), drawing, w, h);
};

const loadWasm = async () => {
  await init().catch((e) => console.error(e.message));
  console.log("WASM Loaded");
};

const size: Dimensions = {
  w: 512,
  h: 512,
  original_height: 512,
  original_width: 512,
};
initEngine(size);
