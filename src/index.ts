import test from "./assets/test.json";
// import test from "./assets/simple.json";
import { draw, draw_gpu, default as init } from "./assets/wasm/renderer";
import "./reset.css";
import "./styles.css";

init().then(() => {
  console.log("WASM Loaded");
  const drawing = JSON.stringify(test);
  draw(document.getElementById("ref-canvas"), drawing);
  draw_gpu(drawing);
});
