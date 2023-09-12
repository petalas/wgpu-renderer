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

import {
  Engine,
  draw_without_gpu,
  default as init,
} from "./assets/wasm/renderer";

// @ts-ignore // FIXME: Cannot find module but it actually works fine?
import firefox from "./assets/firefox.jpg";

import {BehaviorSubject, throttleTime} from "rxjs";
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

export interface Stats {
  generated: number;
  generatedPerSecond: number;
  improvements: number;
  improvementsPerSecond: number;
  sessionStartedAt: number;
  sessionDuration: number;
  cycleTime: number; // duration of the entire cycle
  ticks: number; // number of ticks during last cycle
}

// max for both dimensions -> will scale down maintaining aspect ratio
const MAX_SIZE = 384;

const FPS_TARGET = 60;
const TARGET_FRAMETIME = Math.round(1000 / FPS_TARGET);

const stats$: BehaviorSubject<Stats> = new BehaviorSubject<Stats>({
  generated: 0,
  generatedPerSecond: 0,
  improvements: 0,
  improvementsPerSecond: 0,
  sessionDuration: 0,
  sessionStartedAt: new Date().getTime(),
  cycleTime: 0,
  ticks: 0,
});

const updateUIstats = (stats: Stats) => {
  const statsArea = document.getElementById("stats") as HTMLTextAreaElement;
  let rows: string[] = [];
  rows.push(`Session stats:`);
  rows.push(
    `Generated: ${stats?.generated || 0} mutations ~ ${
      stats?.generatedPerSecond?.toFixed(2) || 0
    }/s`
  );
  rows.push(
    `Improvements: ${stats?.improvements || 0} ~ ${
      stats?.improvementsPerSecond?.toFixed(2) || 0
    }/s`
  );
  rows.push(
    `Engine: last cycle took ${stats?.cycleTime || 0}ms ~ ${
      stats?.ticks || 0
    } ticks/cycle.`
  );

  requestAnimationFrame(
    () =>
      (statsArea.innerHTML = rows.map((r) => `<span>${r}</span>`).join("\n"))
  );
};

stats$.pipe(throttleTime(42)).subscribe((stats: Stats) => updateUIstats(stats));

let paused = true;
let animationId: number = null;

const play = () => {
  resetStats();
  loop();
  paused = false;
};

// FIXME doesn't seem to pause reliably
const pause = () => {
  paused = true;
  cancelAnimationFrame(animationId);
  animationId = null;
};

// FIXME: loop can't be async but if we don't explicitly await on engine.tick we get
// Error: recursive use of an object detected which would lead to unsafe aliasing in rust
const loop = () => {
  tick(TARGET_FRAMETIME, "wgpu-canvas")
    .then((statsFromEngine) => {
      let stats = stats$.getValue();
      stats = { ...stats, ...statsFromEngine }; // update generation and mutation counts
      stats.sessionDuration =
        (new Date().getTime() - stats.sessionStartedAt) / 1000.0;
      stats.generatedPerSecond = stats.generated / stats.sessionDuration;
      stats.improvementsPerSecond = stats.improvements / stats.sessionDuration;
      stats$.next(stats);
      return null; // doesn't matter what we return, just to prevent the next one from running concurrently
    })
    .then(() => {
      if (!paused) {
        animationId = requestAnimationFrame(loop);
      }
    });
};

const tick = async (max_time_ms: number, canvas_id: string): Promise<Stats> => {
  return JSON.parse(await engine.tick(max_time_ms ?? 42, canvas_id)) as Stats;
};

const resetStats = () => {
  stats$.next({
    generated: 0,
    generatedPerSecond: 0,
    improvements: 0,
    improvementsPerSecond: 0,
    sessionDuration: 0,
    sessionStartedAt: new Date().getTime(),
    cycleTime: 0,
    ticks: 0,
  });
  engine.reset_stats();
};

const togglePaused = () => {
  if (paused) {
    play();
  } else {
    pause();
  }
};

// The entry point is source_img.onload
// onload -> initializeWithNewImage -> loadWasm
const source_img = document.getElementById("source-img") as HTMLImageElement;
source_img.crossOrigin = "Anonymous"; // prevent security error
source_img.onload = (): void => initializeWithNewImage(source_img);
source_img.src = firefox;

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
      let w = dimensions.width;
      let h = dimensions.height;
      let original_width = w;
      let original_height = h;

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

      return { w, h, original_width, original_height };
    })
    .then((size: Dimensions) => initEngine(size));
};

const initEngine = async (dimensions: Dimensions) => {
  prepare();
  await loadWasm();
  engine = await createEngine(dimensions);
  await engine.post_init();
  await engine.display_best_drawing("wgpu-canvas");

  const pauseBtn = document.getElementById("pauseBtn");
  !!engine && pauseBtn.removeAttribute("disabled");
};

const createEngine = async (dimensions: Dimensions): Promise<Engine> => {
  const source_bytes = new Uint8Array(getImageData(source_img, dimensions));
  const best_drawing = JSON.stringify(test);
  await draw_without_gpu(best_drawing, "ref-canvas");

  const stats = document.querySelector("p.size-stats") as HTMLParagraphElement;
  stats.innerText = `Rendering at: ${MAX_SIZE}x${MAX_SIZE}\nTriangles: ${
    test?.polygons?.length ?? 0
  }`;

  // test all black
  // const black = [0, 0, 0, 255];
  // const source_bytes = new Uint8Array(Array(w*h).fill(black).flat());
  const { w, h } = dimensions;
  return Engine.new(source_bytes, best_drawing, w, h); // pass best_drawing instead of null normally, testing starting from scratch
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

  const setupPauseBtn = () => {
    const pauseBtn = document.getElementById("pauseBtn");
    pauseBtn.setAttribute("disabled", "true");
    pauseBtn.innerText = paused ? "Resume" : "Pause";
    pauseBtn.onclick = async () => {
      togglePaused();
      pauseBtn.innerText = paused ? "Resume" : "Pause";
    };
  };

  const loopTimes = document.getElementById("loopTimes") as HTMLInputElement;
  loopTimes.onchange = (e) => {
    const self = e.target as HTMLButtonElement;
    const val = Number(self.value);
    setupLoopBtn(val);
  };

  setupLoopBtn(Number(loopTimes.value));
  setupPauseBtn();
  checkSizes();
};

const getImageData = (img: HTMLImageElement, settings: Dimensions) => {
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
