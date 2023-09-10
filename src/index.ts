import test from "./assets/test.json";
// import test from "./assets/simple.json";
import {
  draw,
  draw_gpu,
  start_loop,
  default as init,
} from "./assets/wasm/renderer";

// @ts-ignore // FIXME: Cannot find module but it actually works fine?
import firefox from "./assets/firefox.jpg";

import "./reset.css";
import "./styles.css";

export interface ImageDimensions {
  width: number;
  height: number;
}

const size = 384;

let adjusted_width: number;
let adjusted_height: number;

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
      let w = dimensions.width;
      let h = dimensions.height;

      let newSize;
      if (w > size || h > size) {
        newSize = calculateAspectRatioFit(w, h, size, size);
        w = newSize.width;
        h = newSize.height;
      }

      const ref = document.getElementById("ref-canvas") as HTMLCanvasElement;
      // const wgpu = document.getElementById("wgpu-canvas") as HTMLCanvasElement;
      img.width = w;
      img.height = h;
      ref.width = w;
      ref.height = h;
      // wgpu.width = w;
      // wgpu.height = h;

      adjusted_width = w;
      adjusted_height = h;
    })
    .then(() => loadWasm());
};

const source_img = document.getElementById("source-img") as HTMLImageElement;
source_img.crossOrigin = "Anonymous"; // prevent security error
source_img.onload = (): void => initializeWithNewImage(source_img);
source_img.src = firefox;

const getImageData = (img: HTMLImageElement) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.drawImage(img, 0, 0);
  return context.getImageData(0, 0, size, size);
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
  const wgpu = document.getElementById("wgpu-canvas") as HTMLCanvasElement;
  wgpu.width = adjusted_width;
  wgpu.height = adjusted_height;

  checkSizes();
  const drawing = JSON.stringify(test);

  const stats = document.querySelector("p.stats") as HTMLParagraphElement;
  stats.innerText = `Rendering at: ${size}x${size}\nTriangles: ${test.polygons.length}`;

  const source_bytes = new Uint8Array(getImageData(source_img).data);

  draw(document.getElementById("ref-canvas"), drawing, size, size);
  draw_gpu(drawing, size, size, source_bytes);

  const setupLoopBtn = (times: number) => {
    const loopBtn = document.getElementById("loopBtn");
    loopBtn.innerText = `Loop ${times} times`;
    loopBtn.onclick = () =>
      start_loop(drawing, size, size, source_bytes, times);
  };

  const loopTimes = document.getElementById("loopTimes") as HTMLInputElement;
  loopTimes.onchange = (e) => {
    const self = e.target as HTMLButtonElement;
    const val = Number(self.value);
    setupLoopBtn(val);
  };

  setupLoopBtn(Number(loopTimes.value));
};
