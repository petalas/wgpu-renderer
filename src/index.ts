import test from "./assets/test.json";
import { draw, default as init } from "./assets/wasm/renderer";
import "./reset.css";
import "./styles.css";

init().then(() => {
  console.log("WASM Loaded");
  draw(document.getElementById("ref-canvas"), JSON.stringify(test));
});
