import test from "./assets/test.json";
// import test from "./assets/test2"; // a: 127
// import test from "./assets/test6"; // a: 127 no background
// import test from "./assets/test7"; // a: 127 white background
// import test from "./assets/test3"; // a: 224
// import test from "./assets/test4"; // a: 32
// import test from "./assets/test5"; // a: 32 no background
// import test from "./assets/test8.json"; // 2 triangles on top of 2 white triangles
// import test from "./assets/simple.json";

// TEST RESULTS: drawing 2 full white triangles first 'fixes' the blending

// TODO: clean up imports

import { Engine, draw_without_gpu ,default as init } from "./assets/wasm/renderer";

// @ts-ignore // FIXME: Cannot find module but it actually works fine?
import firefox from "./assets/firefox.jpg";

import "./reset.css";
import "./styles.css";

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface Settings {
  w: number;
  h: number;
  original_width: number;
  original_height: number;
}

// The entry point is source_img.onload
// onload -> initializeWithNewImage -> loadWasm
const source_img = document.getElementById("source-img") as HTMLImageElement;
source_img.crossOrigin = "Anonymous"; // prevent security error
source_img.onload = (): void => initializeWithNewImage(source_img);
source_img.src = firefox;

// max for both dimensions -> will scale down maintaining aspect ratio
const MAX_SIZE = 512;

// original source image dimensions
let original_width: number;
let original_height: number;

// adjusted based on aspect ratio fit for max width and max height = size
let w: number;
let h: number;

let engine: Engine;

const getRealImageSize = (src: string): Promise<ImageDimensions> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = src;
  });
};

const calculateAspectRatioFit = (
  srcWidth: number,
  srcHeight: number,
  maxWidth: number,
  maxHeight: number
): ImageDimensions => {
  const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
  return {
    width: Math.round(srcWidth * ratio),
    height: Math.round(srcHeight * ratio),
  };
};

const initializeWithNewImage = (img: HTMLImageElement) => {
  getRealImageSize(img.src)
    .then((dimensions) => {
      w = dimensions.width;
      h = dimensions.height;
      original_width = w;
      original_height = h;

      let newSize;
      if (w > MAX_SIZE || h > MAX_SIZE) {
        newSize = calculateAspectRatioFit(w, h, MAX_SIZE, MAX_SIZE);
        w = newSize.width;
        h = newSize.height;
      }

      // from now on working with w, h --> original dimensions only readed to read source_bytes correctly

      const ref = document.getElementById("ref-canvas") as HTMLCanvasElement;
      const wgpu = document.getElementById("wgpu-canvas") as HTMLCanvasElement;
      img.width = w;
      img.height = h;
      ref.width = w;
      ref.height = h;
      wgpu.width = w;
      wgpu.height = h;
    })
    .then(() => initEngine({ w, h, original_width, original_height }));
};

const initEngine = async (settings: Settings) => {
  prepare();
  await loadWasm();
  engine = await createEngine(settings);
  await engine.post_init();
  await engine.display_best_drawing("wgpu-canvas");
};

const createEngine = async (settings: Settings): Promise<Engine> => {
  const source_bytes = new Uint8Array(getImageData(source_img, settings));
  const best_drawing = JSON.stringify(test);
  await draw_without_gpu(best_drawing, "ref-canvas");

  const stats = document.querySelector("p.stats") as HTMLParagraphElement;
  stats.innerText = `Rendering at: ${MAX_SIZE}x${MAX_SIZE}\nTriangles: ${
    test?.polygons?.length ?? 0
  }`;

  // test all black
  // const black = [0, 0, 0, 255];
  // const source_bytes = new Uint8Array(Array(w*h).fill(black).flat());
  return Engine.new(source_bytes, null, w, h); // pass best_drawing instead of null normally, testing starting from scratch
};

// called before loadWasm to adjust UI and setup state
const prepare = () => {
  const setupLoopBtn = (times: number) => {
    const loopBtn = document.getElementById("loopBtn");
    loopBtn.innerText = `Loop ${times} times`;
    loopBtn.onclick = async () => {
      loopBtn.setAttribute("disabled", "true");
      await engine.loop_n_times(times, "wgpu-canvas");
      loopBtn.removeAttribute("disabled");
    };
  };

  const loopTimes = document.getElementById("loopTimes") as HTMLInputElement;
  loopTimes.onchange = (e) => {
    const self = e.target as HTMLButtonElement;
    const val = Number(self.value);
    setupLoopBtn(val);
  };

  setupLoopBtn(Number(loopTimes.value));
  checkSizes();
};

const getImageData = (img: HTMLImageElement, settings: Settings) => {
  const { w, h, original_width, original_height } = settings;
  console.log("getImageData", w, h, original_width, original_height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d");
  context.drawImage(img, 0, 0, original_width, original_height, 0, 0, w, h);
  return context.getImageData(0, 0, w, h).data;
};

const checkSizes = () => {
  const img = document.getElementById("source-img") as HTMLImageElement;
  const ref = document.getElementById("ref-canvas") as HTMLCanvasElement;
  const wgpu = document.getElementById("wgpu-canvas") as HTMLCanvasElement;
  console.log(`img.width = ${img.width}, img.height = ${img.height}`);
  console.log(`ref.width = ${ref.width}, ref.height = ${ref.height}`);
  console.log(`wgpu.width = ${wgpu.width}, wgpu.height = ${wgpu.height}`);
};

const loadWasm = async () => {
  await init().catch((e) => console.error(e.message));
  console.log("WASM Loaded");
};
