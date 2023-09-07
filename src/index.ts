import test from "./assets/test.json";
// import test from "./assets/simple.json";
import { draw, draw_gpu, default as init } from "./assets/wasm/renderer";

// @ts-ignore // FIXME: Cannot find module but it actually works fine?
import firefox from "./assets/firefox.jpg";

import "./reset.css";
import "./styles.css";

const size = 512;

const source_img = document.getElementById("source-img") as HTMLImageElement;
source_img.src = firefox;

init().then(() => {
  console.log("WASM Loaded");
  const drawing = JSON.stringify(test);

  const stats = document.querySelector("p.stats") as HTMLParagraphElement;
  stats.innerText = `Rendering at: ${size}x${size}\nTriangles: ${test.polygons.length}`;

  draw(document.getElementById("ref-canvas"), drawing, size, size);
  draw_gpu(drawing, size, size);
});
