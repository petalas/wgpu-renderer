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

const size = 384;

const source_img = document.getElementById("source-img") as HTMLImageElement;
source_img.src = firefox;

const getImageData = (img: HTMLImageElement) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = img.width;
  canvas.height = img.height;
  context.drawImage(img, 0, 0);
  return context.getImageData(0, 0, img.width, img.height);
};

init().then(() => {
  console.log("WASM Loaded");
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
});
