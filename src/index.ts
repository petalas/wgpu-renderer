import "./reset.css";
import "./styles.css";

import { default as init } from "./assets/wasm/renderer";

import test from "./assets/test.json";

init().then(() => {
  console.log("WASM Loaded");
  console.log(test);
});
