/* tslint:disable */
/* eslint-disable */
/**
* @param {any} canvas
* @param {any} drawing_json
* @param {number} width
* @param {number} height
*/
export function draw(canvas: any, drawing_json: any, width: number, height: number): void;
/**
* @param {any} drawing_json
* @param {number} width
* @param {number} height
* @param {Uint8Array} source_bytes
* @param {number} n
*/
export function start_loop(drawing_json: any, width: number, height: number, source_bytes: Uint8Array, n: number): void;
/**
* @param {any} drawing_json
* @param {number} width
* @param {number} height
* @param {Uint8Array} source_bytes
*/
export function draw_gpu(drawing_json: any, width: number, height: number, source_bytes: Uint8Array): void;
/**
*/
export function main(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly draw: (a: number, b: number, c: number, d: number) => void;
  readonly start_loop: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly draw_gpu: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly main: () => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly wasm_bindgen__convert__closures__invoke1_mut__h115948c9d706bd36: (a: number, b: number, c: number) => void;
  readonly wasm_bindgen__convert__closures__invoke0_mut__h51a46f91fc43aab0: (a: number, b: number) => void;
  readonly _dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__hb3eed53bdc2436c1: (a: number, b: number, c: number) => void;
  readonly _dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h6cf2b29f1713bf26: (a: number, b: number, c: number) => void;
  readonly _dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h1e2170f7e2ff2838: (a: number, b: number, c: number) => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_exn_store: (a: number) => void;
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
