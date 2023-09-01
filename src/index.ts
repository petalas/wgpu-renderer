import "./reset.css";
import "./styles.css";

import { default as init } from "./assets/wasm/renderer";

init().then(() => {
  console.log("WASM Loaded");
});
