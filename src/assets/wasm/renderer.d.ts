/* tslint:disable */
/* eslint-disable */
/**
* @returns {Promise<void>}
*/
export function main(): Promise<void>;
/**
* @param {any} drawing_json
* @param {string} canvas_id
* @returns {Uint8Array}
*/
export function draw_without_gpu(drawing_json: any, canvas_id: string): Uint8Array;
/**
*/
export class Engine {
  free(): void;
/**
*/
  toggle_pause(): void;
/**
* @param {Uint8Array} source_bytes
* @param {any} best_drawing
* @param {number} width
* @param {number} height
* @returns {Promise<Engine>}
*/
  static new(source_bytes: Uint8Array, best_drawing: any, width: number, height: number): Promise<Engine>;
/**
* @returns {Promise<void>}
*/
  post_init(): Promise<void>;
/**
* @param {string} canvas_id
* @returns {Promise<void>}
*/
  display_best_drawing(canvas_id: string): Promise<void>;
/**
* @param {number} n
* @param {string} canvas_id
* @returns {Promise<void>}
*/
  loop_n_times(n: number, canvas_id: string): Promise<void>;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly main: () => void;
  readonly draw_without_gpu: (a: number, b: number, c: number, d: number) => void;
  readonly __wbg_engine_free: (a: number) => void;
  readonly engine_toggle_pause: (a: number) => void;
  readonly engine_new: (a: number, b: number, c: number, d: number, e: number) => number;
  readonly engine_post_init: (a: number) => number;
  readonly engine_display_best_drawing: (a: number, b: number, c: number) => number;
  readonly engine_loop_n_times: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly _dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__ha2ed310a2790a573: (a: number, b: number, c: number) => void;
  readonly _dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h1e2170f7e2ff2838: (a: number, b: number, c: number) => void;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly wasm_bindgen__convert__closures__invoke2_mut__h16f3eaa2e1626db2: (a: number, b: number, c: number, d: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {SyncInitInput} module
*
* @returns {InitOutput}
*/
export function initSync(module: SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
