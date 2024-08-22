let wasm;

const heap = new Array(128).fill(undefined);

heap.push(undefined, null, true, false);

function getObject(idx) { return heap[idx]; }

let heap_next = heap.length;

function dropObject(idx) {
    if (idx < 132) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

let WASM_VECTOR_LEN = 0;

const cachedTextEncoder = (typeof TextEncoder !== 'undefined' ? new TextEncoder('utf-8') : { encode: () => { throw Error('TextEncoder not available') } } );

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
}
    : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
});

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

const CLOSURE_DTORS = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(state => {
    wasm.__wbindgen_export_2.get(state.dtor)(state.a, state.b)
});

function makeMutClosure(arg0, arg1, dtor, f) {
    const state = { a: arg0, b: arg1, cnt: 1, dtor };
    const real = (...args) => {
        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            if (--state.cnt === 0) {
                wasm.__wbindgen_export_2.get(state.dtor)(a, state.b);
                CLOSURE_DTORS.unregister(state);
            } else {
                state.a = a;
            }
        }
    };
    real.original = state;
    CLOSURE_DTORS.register(real, state, state);
    return real;
}
function __wbg_adapter_30(arg0, arg1, arg2) {
    wasm._dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h3868036d210dfbcc(arg0, arg1, addHeapObject(arg2));
}

function __wbg_adapter_35(arg0, arg1, arg2) {
    wasm._dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__haabb451ac45a4254(arg0, arg1, addHeapObject(arg2));
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
* @returns {Promise<void>}
*/
export function main() {
    wasm.main();
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}
/**
* @param {any} drawing_json
* @param {string} canvas_id
* @returns {Uint8Array}
*/
export function draw_without_gpu(drawing_json, canvas_id) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(canvas_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.draw_without_gpu(retptr, addHeapObject(drawing_json), ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v2 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_free(r0, r1 * 1, 1);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        wasm.__wbindgen_exn_store(addHeapObject(e));
    }
}

let cachedUint32ArrayMemory0 = null;

function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

let cachedUint8ClampedArrayMemory0 = null;

function getUint8ClampedArrayMemory0() {
    if (cachedUint8ClampedArrayMemory0 === null || cachedUint8ClampedArrayMemory0.byteLength === 0) {
        cachedUint8ClampedArrayMemory0 = new Uint8ClampedArray(wasm.memory.buffer);
    }
    return cachedUint8ClampedArrayMemory0;
}

function getClampedArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ClampedArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}
function __wbg_adapter_445(arg0, arg1, arg2, arg3) {
    wasm.wasm_bindgen__convert__closures__invoke2_mut__ha9797427dd5572ac(arg0, arg1, addHeapObject(arg2), addHeapObject(arg3));
}

const EngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_engine_free(ptr >>> 0, 1));
/**
*/
export class Engine {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Engine.prototype);
        obj.__wbg_ptr = ptr;
        EngineFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        EngineFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_engine_free(ptr, 0);
    }
    /**
    */
    toggle_pause() {
        wasm.engine_toggle_pause(this.__wbg_ptr);
    }
    /**
    * @param {Uint8Array} source_bytes
    * @param {any} best_drawing
    * @param {number} width
    * @param {number} height
    * @returns {Promise<Engine>}
    */
    static new(source_bytes, best_drawing, width, height) {
        const ptr0 = passArray8ToWasm0(source_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.engine_new(ptr0, len0, addHeapObject(best_drawing), width, height);
        return takeObject(ret);
    }
    /**
    * @returns {Promise<void>}
    */
    post_init() {
        const ret = wasm.engine_post_init(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
    * @param {number} max_time_ms
    * @param {string} canvas_id
    * @returns {Promise<any>}
    */
    tick(max_time_ms, canvas_id) {
        const ptr0 = passStringToWasm0(canvas_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.engine_tick(this.__wbg_ptr, max_time_ms, ptr0, len0);
        return takeObject(ret);
    }
    /**
    */
    reset_stats() {
        wasm.engine_reset_stats(this.__wbg_ptr);
    }
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                if (module.headers.get('Content-Type') != 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbindgen_object_drop_ref = function(arg0) {
        takeObject(arg0);
    };
    imports.wbg.__wbindgen_is_falsy = function(arg0) {
        const ret = !getObject(arg0);
        return ret;
    };
    imports.wbg.__wbg_engine_new = function(arg0) {
        const ret = Engine.__wrap(arg0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
        const ret = getStringFromWasm0(arg0, arg1);
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_string_get = function(arg0, arg1) {
        const obj = getObject(arg1);
        const ret = typeof(obj) === 'string' ? obj : undefined;
        var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_new_abda76e883ba8a5f = function() {
        const ret = new Error();
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_stack_658279fe44541cf6 = function(arg0, arg1) {
        const ret = getObject(arg1).stack;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_error_f851667af71bcfc6 = function(arg0, arg1) {
        let deferred0_0;
        let deferred0_1;
        try {
            deferred0_0 = arg0;
            deferred0_1 = arg1;
            console.error(getStringFromWasm0(arg0, arg1));
        } finally {
            wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
        }
    };
    imports.wbg.__wbg_crypto_1d1f22824a6a080c = function(arg0) {
        const ret = getObject(arg0).crypto;
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_is_object = function(arg0) {
        const val = getObject(arg0);
        const ret = typeof(val) === 'object' && val !== null;
        return ret;
    };
    imports.wbg.__wbg_process_4a72847cc503995b = function(arg0) {
        const ret = getObject(arg0).process;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_versions_f686565e586dd935 = function(arg0) {
        const ret = getObject(arg0).versions;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_node_104a2ff8d6ea03a2 = function(arg0) {
        const ret = getObject(arg0).node;
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_is_string = function(arg0) {
        const ret = typeof(getObject(arg0)) === 'string';
        return ret;
    };
    imports.wbg.__wbg_require_cca90b1a94a0255b = function() { return handleError(function () {
        const ret = module.require;
        return addHeapObject(ret);
    }, arguments) };
    imports.wbg.__wbindgen_is_function = function(arg0) {
        const ret = typeof(getObject(arg0)) === 'function';
        return ret;
    };
    imports.wbg.__wbg_msCrypto_eb05e62b530a1508 = function(arg0) {
        const ret = getObject(arg0).msCrypto;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_randomFillSync_5c9c955aa56b6049 = function() { return handleError(function (arg0, arg1) {
        getObject(arg0).randomFillSync(takeObject(arg1));
    }, arguments) };
    imports.wbg.__wbg_getRandomValues_3aa56aa6edec874c = function() { return handleError(function (arg0, arg1) {
        getObject(arg0).getRandomValues(getObject(arg1));
    }, arguments) };
    imports.wbg.__wbg_instanceof_GpuValidationError_05482398d349fd2d = function(arg0) {
        let result;
        try {
            result = getObject(arg0) instanceof GPUValidationError;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_message_4bd9ef09b3092122 = function(arg0, arg1) {
        const ret = getObject(arg1).message;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_instanceof_GpuOutOfMemoryError_658135cd3b3f08e2 = function(arg0) {
        let result;
        try {
            result = getObject(arg0) instanceof GPUOutOfMemoryError;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_type_c3e79de7c41f03c2 = function(arg0) {
        const ret = getObject(arg0).type;
        return {"error":0,"warning":1,"info":2,}[ret] ?? 3;
    };
    imports.wbg.__wbg_offset_47f9a19926637c8e = function(arg0) {
        const ret = getObject(arg0).offset;
        return ret;
    };
    imports.wbg.__wbg_length_ff62902e8840f82f = function(arg0) {
        const ret = getObject(arg0).length;
        return ret;
    };
    imports.wbg.__wbindgen_object_clone_ref = function(arg0) {
        const ret = getObject(arg0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_error_520ca6f621497012 = function(arg0) {
        const ret = getObject(arg0).error;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_instanceof_GpuDeviceLostInfo_c7232ceb822b15d6 = function(arg0) {
        let result;
        try {
            result = getObject(arg0) instanceof GPUDeviceLostInfo;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_reason_436ee862de561851 = function(arg0) {
        const ret = getObject(arg0).reason;
        return {"unknown":0,"destroyed":1,}[ret] ?? 2;
    };
    imports.wbg.__wbg_message_54cb97c0fd1579bf = function(arg0, arg1) {
        const ret = getObject(arg1).message;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbindgen_cb_drop = function(arg0) {
        const obj = takeObject(arg0).original;
        if (obj.cnt-- == 1) {
            obj.a = 0;
            return true;
        }
        const ret = false;
        return ret;
    };
    imports.wbg.__wbg_has_14b751afdcf0a341 = function(arg0, arg1, arg2) {
        const ret = getObject(arg0).has(getStringFromWasm0(arg1, arg2));
        return ret;
    };
    imports.wbg.__wbg_maxTextureDimension1D_71c238385d79f287 = function(arg0) {
        const ret = getObject(arg0).maxTextureDimension1D;
        return ret;
    };
    imports.wbg.__wbg_maxTextureDimension2D_ce910a0ea6c7213b = function(arg0) {
        const ret = getObject(arg0).maxTextureDimension2D;
        return ret;
    };
    imports.wbg.__wbg_maxTextureDimension3D_76032d2a97af63ac = function(arg0) {
        const ret = getObject(arg0).maxTextureDimension3D;
        return ret;
    };
    imports.wbg.__wbg_maxTextureArrayLayers_b561668f7e1ebacc = function(arg0) {
        const ret = getObject(arg0).maxTextureArrayLayers;
        return ret;
    };
    imports.wbg.__wbg_maxBindGroups_d2b688642140a1bb = function(arg0) {
        const ret = getObject(arg0).maxBindGroups;
        return ret;
    };
    imports.wbg.__wbg_maxBindingsPerBindGroup_a3e9e404dd893c83 = function(arg0) {
        const ret = getObject(arg0).maxBindingsPerBindGroup;
        return ret;
    };
    imports.wbg.__wbg_maxDynamicUniformBuffersPerPipelineLayout_98a8fbca367148bf = function(arg0) {
        const ret = getObject(arg0).maxDynamicUniformBuffersPerPipelineLayout;
        return ret;
    };
    imports.wbg.__wbg_maxDynamicStorageBuffersPerPipelineLayout_0dec6aea74b472ad = function(arg0) {
        const ret = getObject(arg0).maxDynamicStorageBuffersPerPipelineLayout;
        return ret;
    };
    imports.wbg.__wbg_maxSampledTexturesPerShaderStage_7a0712465c0a12b4 = function(arg0) {
        const ret = getObject(arg0).maxSampledTexturesPerShaderStage;
        return ret;
    };
    imports.wbg.__wbg_maxSamplersPerShaderStage_6716e9792fc2a833 = function(arg0) {
        const ret = getObject(arg0).maxSamplersPerShaderStage;
        return ret;
    };
    imports.wbg.__wbg_maxStorageBuffersPerShaderStage_640d34738978a4ff = function(arg0) {
        const ret = getObject(arg0).maxStorageBuffersPerShaderStage;
        return ret;
    };
    imports.wbg.__wbg_maxStorageTexturesPerShaderStage_6614a1e40f7e2827 = function(arg0) {
        const ret = getObject(arg0).maxStorageTexturesPerShaderStage;
        return ret;
    };
    imports.wbg.__wbg_maxUniformBuffersPerShaderStage_1ff2f3c6468374ae = function(arg0) {
        const ret = getObject(arg0).maxUniformBuffersPerShaderStage;
        return ret;
    };
    imports.wbg.__wbg_maxUniformBufferBindingSize_8830a8df4f730637 = function(arg0) {
        const ret = getObject(arg0).maxUniformBufferBindingSize;
        return ret;
    };
    imports.wbg.__wbg_maxStorageBufferBindingSize_10b6eb49372335bc = function(arg0) {
        const ret = getObject(arg0).maxStorageBufferBindingSize;
        return ret;
    };
    imports.wbg.__wbg_maxVertexBuffers_9f97f2a89863a431 = function(arg0) {
        const ret = getObject(arg0).maxVertexBuffers;
        return ret;
    };
    imports.wbg.__wbg_maxBufferSize_1c8b836056558ebf = function(arg0) {
        const ret = getObject(arg0).maxBufferSize;
        return ret;
    };
    imports.wbg.__wbg_maxVertexAttributes_cff466bbace9aa7c = function(arg0) {
        const ret = getObject(arg0).maxVertexAttributes;
        return ret;
    };
    imports.wbg.__wbg_maxVertexBufferArrayStride_fb650714a5bd0e68 = function(arg0) {
        const ret = getObject(arg0).maxVertexBufferArrayStride;
        return ret;
    };
    imports.wbg.__wbg_minUniformBufferOffsetAlignment_0168a0d08b19afbe = function(arg0) {
        const ret = getObject(arg0).minUniformBufferOffsetAlignment;
        return ret;
    };
    imports.wbg.__wbg_minStorageBufferOffsetAlignment_3b63a59f37f275f8 = function(arg0) {
        const ret = getObject(arg0).minStorageBufferOffsetAlignment;
        return ret;
    };
    imports.wbg.__wbg_maxInterStageShaderComponents_db659eaa3b248a74 = function(arg0) {
        const ret = getObject(arg0).maxInterStageShaderComponents;
        return ret;
    };
    imports.wbg.__wbg_maxColorAttachments_e821b856b5cba24e = function(arg0) {
        const ret = getObject(arg0).maxColorAttachments;
        return ret;
    };
    imports.wbg.__wbg_maxColorAttachmentBytesPerSample_ab770042dd82a5bf = function(arg0) {
        const ret = getObject(arg0).maxColorAttachmentBytesPerSample;
        return ret;
    };
    imports.wbg.__wbg_maxComputeWorkgroupStorageSize_e6773eb1cbfa7a83 = function(arg0) {
        const ret = getObject(arg0).maxComputeWorkgroupStorageSize;
        return ret;
    };
    imports.wbg.__wbg_maxComputeInvocationsPerWorkgroup_4ed447998b195973 = function(arg0) {
        const ret = getObject(arg0).maxComputeInvocationsPerWorkgroup;
        return ret;
    };
    imports.wbg.__wbg_maxComputeWorkgroupSizeX_de94f4925b26c73c = function(arg0) {
        const ret = getObject(arg0).maxComputeWorkgroupSizeX;
        return ret;
    };
    imports.wbg.__wbg_maxComputeWorkgroupSizeY_cb75de6b450c8915 = function(arg0) {
        const ret = getObject(arg0).maxComputeWorkgroupSizeY;
        return ret;
    };
    imports.wbg.__wbg_maxComputeWorkgroupSizeZ_6277d18773d70891 = function(arg0) {
        const ret = getObject(arg0).maxComputeWorkgroupSizeZ;
        return ret;
    };
    imports.wbg.__wbg_maxComputeWorkgroupsPerDimension_baef21641827881d = function(arg0) {
        const ret = getObject(arg0).maxComputeWorkgroupsPerDimension;
        return ret;
    };
    imports.wbg.__wbg_instanceof_GpuAdapter_ba82c448cfa55608 = function(arg0) {
        let result;
        try {
            result = getObject(arg0) instanceof GPUAdapter;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_queue_e124eaca54d285d4 = function(arg0) {
        const ret = getObject(arg0).queue;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_instanceof_GpuCanvasContext_1eacd2a8c6b36ada = function(arg0) {
        let result;
        try {
            result = getObject(arg0) instanceof GPUCanvasContext;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_getMappedRange_08e71df297c66a50 = function(arg0, arg1, arg2) {
        const ret = getObject(arg0).getMappedRange(arg1, arg2);
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_Window_4d1f8d969d639a22 = function(arg0) {
        const ret = getObject(arg0).Window;
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_is_undefined = function(arg0) {
        const ret = getObject(arg0) === undefined;
        return ret;
    };
    imports.wbg.__wbg_WorkerGlobalScope_c4f12290f7d2efed = function(arg0) {
        const ret = getObject(arg0).WorkerGlobalScope;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_gpu_7d756a02ad45027d = function(arg0) {
        const ret = getObject(arg0).gpu;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_requestAdapter_8413757c51a35b1d = function(arg0, arg1) {
        const ret = getObject(arg0).requestAdapter(getObject(arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_number_new = function(arg0) {
        const ret = arg0;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_requestDevice_1c8e4f0fe8729328 = function(arg0, arg1) {
        const ret = getObject(arg0).requestDevice(getObject(arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_features_e7f12cb6c5258238 = function(arg0) {
        const ret = getObject(arg0).features;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_limits_622a6ae19a037dbf = function(arg0) {
        const ret = getObject(arg0).limits;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_getPreferredCanvasFormat_d55bc32b5a6b948a = function(arg0) {
        const ret = getObject(arg0).getPreferredCanvasFormat();
        return {"r8unorm":0,"r8snorm":1,"r8uint":2,"r8sint":3,"r16uint":4,"r16sint":5,"r16float":6,"rg8unorm":7,"rg8snorm":8,"rg8uint":9,"rg8sint":10,"r32uint":11,"r32sint":12,"r32float":13,"rg16uint":14,"rg16sint":15,"rg16float":16,"rgba8unorm":17,"rgba8unorm-srgb":18,"rgba8snorm":19,"rgba8uint":20,"rgba8sint":21,"bgra8unorm":22,"bgra8unorm-srgb":23,"rgb9e5ufloat":24,"rgb10a2uint":25,"rgb10a2unorm":26,"rg11b10ufloat":27,"rg32uint":28,"rg32sint":29,"rg32float":30,"rgba16uint":31,"rgba16sint":32,"rgba16float":33,"rgba32uint":34,"rgba32sint":35,"rgba32float":36,"stencil8":37,"depth16unorm":38,"depth24plus":39,"depth24plus-stencil8":40,"depth32float":41,"depth32float-stencil8":42,"bc1-rgba-unorm":43,"bc1-rgba-unorm-srgb":44,"bc2-rgba-unorm":45,"bc2-rgba-unorm-srgb":46,"bc3-rgba-unorm":47,"bc3-rgba-unorm-srgb":48,"bc4-r-unorm":49,"bc4-r-snorm":50,"bc5-rg-unorm":51,"bc5-rg-snorm":52,"bc6h-rgb-ufloat":53,"bc6h-rgb-float":54,"bc7-rgba-unorm":55,"bc7-rgba-unorm-srgb":56,"etc2-rgb8unorm":57,"etc2-rgb8unorm-srgb":58,"etc2-rgb8a1unorm":59,"etc2-rgb8a1unorm-srgb":60,"etc2-rgba8unorm":61,"etc2-rgba8unorm-srgb":62,"eac-r11unorm":63,"eac-r11snorm":64,"eac-rg11unorm":65,"eac-rg11snorm":66,"astc-4x4-unorm":67,"astc-4x4-unorm-srgb":68,"astc-5x4-unorm":69,"astc-5x4-unorm-srgb":70,"astc-5x5-unorm":71,"astc-5x5-unorm-srgb":72,"astc-6x5-unorm":73,"astc-6x5-unorm-srgb":74,"astc-6x6-unorm":75,"astc-6x6-unorm-srgb":76,"astc-8x5-unorm":77,"astc-8x5-unorm-srgb":78,"astc-8x6-unorm":79,"astc-8x6-unorm-srgb":80,"astc-8x8-unorm":81,"astc-8x8-unorm-srgb":82,"astc-10x5-unorm":83,"astc-10x5-unorm-srgb":84,"astc-10x6-unorm":85,"astc-10x6-unorm-srgb":86,"astc-10x8-unorm":87,"astc-10x8-unorm-srgb":88,"astc-10x10-unorm":89,"astc-10x10-unorm-srgb":90,"astc-12x10-unorm":91,"astc-12x10-unorm-srgb":92,"astc-12x12-unorm":93,"astc-12x12-unorm-srgb":94,}[ret] ?? 95;
    };
    imports.wbg.__wbg_configure_48cfbf148a9998c2 = function(arg0, arg1) {
        getObject(arg0).configure(getObject(arg1));
    };
    imports.wbg.__wbg_getCurrentTexture_1c8e29bec577927d = function(arg0) {
        const ret = getObject(arg0).getCurrentTexture();
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_features_b1971639ec1a77f7 = function(arg0) {
        const ret = getObject(arg0).features;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_limits_e806d307d42a9dde = function(arg0) {
        const ret = getObject(arg0).limits;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_createShaderModule_cda89eb5c1073627 = function(arg0, arg1) {
        const ret = getObject(arg0).createShaderModule(getObject(arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_createBindGroupLayout_4243a95be946d48a = function(arg0, arg1) {
        const ret = getObject(arg0).createBindGroupLayout(getObject(arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_createBindGroup_f93afa3a0a06b10e = function(arg0, arg1) {
        const ret = getObject(arg0).createBindGroup(getObject(arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_createPipelineLayout_bcb406883550f9cc = function(arg0, arg1) {
        const ret = getObject(arg0).createPipelineLayout(getObject(arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_createRenderPipeline_7ca396c186d8d06a = function(arg0, arg1) {
        const ret = getObject(arg0).createRenderPipeline(getObject(arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_createComputePipeline_fb60500f9a96e290 = function(arg0, arg1) {
        const ret = getObject(arg0).createComputePipeline(getObject(arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_createBuffer_44406243485760b1 = function(arg0, arg1) {
        const ret = getObject(arg0).createBuffer(getObject(arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_createTexture_06106f81b60e5462 = function(arg0, arg1) {
        const ret = getObject(arg0).createTexture(getObject(arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_createSampler_ed81ff565caa903a = function(arg0, arg1) {
        const ret = getObject(arg0).createSampler(getObject(arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_createQuerySet_4040f9ea5a2ac03c = function(arg0, arg1) {
        const ret = getObject(arg0).createQuerySet(getObject(arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_createCommandEncoder_c7eddb5143f91992 = function(arg0, arg1) {
        const ret = getObject(arg0).createCommandEncoder(getObject(arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_createRenderBundleEncoder_d9644450ab4cad8f = function(arg0, arg1) {
        const ret = getObject(arg0).createRenderBundleEncoder(getObject(arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_destroy_2a8c41712abac4cb = function(arg0) {
        getObject(arg0).destroy();
    };
    imports.wbg.__wbg_lost_02e8ddfb37103cc2 = function(arg0) {
        const ret = getObject(arg0).lost;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_setonuncapturederror_c702acc9eeeb9613 = function(arg0, arg1) {
        getObject(arg0).onuncapturederror = getObject(arg1);
    };
    imports.wbg.__wbg_pushErrorScope_3dc565fa86fee870 = function(arg0, arg1) {
        getObject(arg0).pushErrorScope(["validation","out-of-memory","internal",][arg1]);
    };
    imports.wbg.__wbg_popErrorScope_6d6b4abc95412374 = function(arg0) {
        const ret = getObject(arg0).popErrorScope();
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_mapAsync_98ce4986e2f6d4af = function(arg0, arg1, arg2, arg3) {
        const ret = getObject(arg0).mapAsync(arg1 >>> 0, arg2, arg3);
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_unmap_efca7885e5daff78 = function(arg0) {
        getObject(arg0).unmap();
    };
    imports.wbg.__wbg_getCompilationInfo_adcb4d74ed54d1f9 = function(arg0) {
        const ret = getObject(arg0).getCompilationInfo();
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_messages_6833dfd0ae6a0a7c = function(arg0) {
        const ret = getObject(arg0).messages;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_createView_87e589e1574ba76c = function(arg0, arg1) {
        const ret = getObject(arg0).createView(getObject(arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_destroy_387cb19081689594 = function(arg0) {
        getObject(arg0).destroy();
    };
    imports.wbg.__wbg_destroy_b040948312c539a9 = function(arg0) {
        getObject(arg0).destroy();
    };
    imports.wbg.__wbg_getBindGroupLayout_0194b7a790ac805d = function(arg0, arg1) {
        const ret = getObject(arg0).getBindGroupLayout(arg1 >>> 0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_getBindGroupLayout_1490d5a61f4fd56b = function(arg0, arg1) {
        const ret = getObject(arg0).getBindGroupLayout(arg1 >>> 0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_copyBufferToBuffer_f0736fef84f76be5 = function(arg0, arg1, arg2, arg3, arg4, arg5) {
        getObject(arg0).copyBufferToBuffer(getObject(arg1), arg2, getObject(arg3), arg4, arg5);
    };
    imports.wbg.__wbg_copyBufferToTexture_aedde01ad3786b4f = function(arg0, arg1, arg2, arg3) {
        getObject(arg0).copyBufferToTexture(getObject(arg1), getObject(arg2), getObject(arg3));
    };
    imports.wbg.__wbg_copyTextureToBuffer_268207d3e09dfa81 = function(arg0, arg1, arg2, arg3) {
        getObject(arg0).copyTextureToBuffer(getObject(arg1), getObject(arg2), getObject(arg3));
    };
    imports.wbg.__wbg_copyTextureToTexture_7ea3d6de0a82ce7f = function(arg0, arg1, arg2, arg3) {
        getObject(arg0).copyTextureToTexture(getObject(arg1), getObject(arg2), getObject(arg3));
    };
    imports.wbg.__wbg_beginComputePass_df50d9ddd5f32a63 = function(arg0, arg1) {
        const ret = getObject(arg0).beginComputePass(getObject(arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_beginRenderPass_14284a54cee2063b = function(arg0, arg1) {
        const ret = getObject(arg0).beginRenderPass(getObject(arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_label_81cb6c4ebcba5f4d = function(arg0, arg1) {
        const ret = getObject(arg1).label;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_finish_78696a2f194fbb7a = function(arg0, arg1) {
        const ret = getObject(arg0).finish(getObject(arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_finish_7ad9d3e23124bbc6 = function(arg0) {
        const ret = getObject(arg0).finish();
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_clearBuffer_a5ccb106665ad51e = function(arg0, arg1, arg2) {
        getObject(arg0).clearBuffer(getObject(arg1), arg2);
    };
    imports.wbg.__wbg_clearBuffer_f06a69a0aa134d24 = function(arg0, arg1, arg2, arg3) {
        getObject(arg0).clearBuffer(getObject(arg1), arg2, arg3);
    };
    imports.wbg.__wbg_resolveQuerySet_7354946ea63dacbb = function(arg0, arg1, arg2, arg3, arg4, arg5) {
        getObject(arg0).resolveQuerySet(getObject(arg1), arg2 >>> 0, arg3 >>> 0, getObject(arg4), arg5 >>> 0);
    };
    imports.wbg.__wbg_finish_5be91110098e071c = function(arg0) {
        const ret = getObject(arg0).finish();
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_finish_667443ed0047f53a = function(arg0, arg1) {
        const ret = getObject(arg0).finish(getObject(arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_writeBuffer_6ce87bc6ff22a2b5 = function(arg0, arg1, arg2, arg3, arg4, arg5) {
        getObject(arg0).writeBuffer(getObject(arg1), arg2, getObject(arg3), arg4, arg5);
    };
    imports.wbg.__wbg_usage_5043ac06189fbe53 = function(arg0) {
        const ret = getObject(arg0).usage;
        return ret;
    };
    imports.wbg.__wbg_size_61d4fa05868b79cd = function(arg0) {
        const ret = getObject(arg0).size;
        return ret;
    };
    imports.wbg.__wbg_writeTexture_3708ced0dd386721 = function(arg0, arg1, arg2, arg3, arg4) {
        getObject(arg0).writeTexture(getObject(arg1), getObject(arg2), getObject(arg3), getObject(arg4));
    };
    imports.wbg.__wbg_copyExternalImageToTexture_e192d56d70996ad4 = function(arg0, arg1, arg2, arg3) {
        getObject(arg0).copyExternalImageToTexture(getObject(arg1), getObject(arg2), getObject(arg3));
    };
    imports.wbg.__wbg_setPipeline_4d0e04e7370f0e2e = function(arg0, arg1) {
        getObject(arg0).setPipeline(getObject(arg1));
    };
    imports.wbg.__wbg_setBindGroup_48300d51a3d74853 = function(arg0, arg1, arg2) {
        getObject(arg0).setBindGroup(arg1 >>> 0, getObject(arg2));
    };
    imports.wbg.__wbg_setBindGroup_d79f4f1d5e43c06f = function(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
        getObject(arg0).setBindGroup(arg1 >>> 0, getObject(arg2), getArrayU32FromWasm0(arg3, arg4), arg5, arg6 >>> 0);
    };
    imports.wbg.__wbg_dispatchWorkgroups_f0fd90dcd4a506fa = function(arg0, arg1, arg2, arg3) {
        getObject(arg0).dispatchWorkgroups(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0);
    };
    imports.wbg.__wbg_dispatchWorkgroupsIndirect_567a84763f6a0b87 = function(arg0, arg1, arg2) {
        getObject(arg0).dispatchWorkgroupsIndirect(getObject(arg1), arg2);
    };
    imports.wbg.__wbg_end_bbe499813ce72830 = function(arg0) {
        getObject(arg0).end();
    };
    imports.wbg.__wbg_setPipeline_6174c2e8900fe24a = function(arg0, arg1) {
        getObject(arg0).setPipeline(getObject(arg1));
    };
    imports.wbg.__wbg_setBindGroup_de4812744c6ebb6c = function(arg0, arg1, arg2) {
        getObject(arg0).setBindGroup(arg1 >>> 0, getObject(arg2));
    };
    imports.wbg.__wbg_setBindGroup_92581920e209bf52 = function(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
        getObject(arg0).setBindGroup(arg1 >>> 0, getObject(arg2), getArrayU32FromWasm0(arg3, arg4), arg5, arg6 >>> 0);
    };
    imports.wbg.__wbg_setIndexBuffer_91b6f5eb1a43df9b = function(arg0, arg1, arg2, arg3) {
        getObject(arg0).setIndexBuffer(getObject(arg1), ["uint16","uint32",][arg2], arg3);
    };
    imports.wbg.__wbg_setIndexBuffer_5bce79843be8653d = function(arg0, arg1, arg2, arg3, arg4) {
        getObject(arg0).setIndexBuffer(getObject(arg1), ["uint16","uint32",][arg2], arg3, arg4);
    };
    imports.wbg.__wbg_setVertexBuffer_d9b48c3489dcfa22 = function(arg0, arg1, arg2, arg3) {
        getObject(arg0).setVertexBuffer(arg1 >>> 0, getObject(arg2), arg3);
    };
    imports.wbg.__wbg_setVertexBuffer_330ab505b9dfc64b = function(arg0, arg1, arg2, arg3, arg4) {
        getObject(arg0).setVertexBuffer(arg1 >>> 0, getObject(arg2), arg3, arg4);
    };
    imports.wbg.__wbg_draw_29abcb466fee48b4 = function(arg0, arg1, arg2, arg3, arg4) {
        getObject(arg0).draw(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4 >>> 0);
    };
    imports.wbg.__wbg_drawIndexed_34b06707991ddaf7 = function(arg0, arg1, arg2, arg3, arg4, arg5) {
        getObject(arg0).drawIndexed(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4, arg5 >>> 0);
    };
    imports.wbg.__wbg_drawIndirect_0054fe754e8e46e9 = function(arg0, arg1, arg2) {
        getObject(arg0).drawIndirect(getObject(arg1), arg2);
    };
    imports.wbg.__wbg_drawIndexedIndirect_4b7b51fa979657ca = function(arg0, arg1, arg2) {
        getObject(arg0).drawIndexedIndirect(getObject(arg1), arg2);
    };
    imports.wbg.__wbg_setPipeline_8f2f5c316ddb7f68 = function(arg0, arg1) {
        getObject(arg0).setPipeline(getObject(arg1));
    };
    imports.wbg.__wbg_setBindGroup_da48569994113ec3 = function(arg0, arg1, arg2) {
        getObject(arg0).setBindGroup(arg1 >>> 0, getObject(arg2));
    };
    imports.wbg.__wbg_setBindGroup_1c3dd07b998fa943 = function(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
        getObject(arg0).setBindGroup(arg1 >>> 0, getObject(arg2), getArrayU32FromWasm0(arg3, arg4), arg5, arg6 >>> 0);
    };
    imports.wbg.__wbg_setIndexBuffer_1dc175abfd5d9be9 = function(arg0, arg1, arg2, arg3) {
        getObject(arg0).setIndexBuffer(getObject(arg1), ["uint16","uint32",][arg2], arg3);
    };
    imports.wbg.__wbg_setIndexBuffer_a0fcb26f210351b7 = function(arg0, arg1, arg2, arg3, arg4) {
        getObject(arg0).setIndexBuffer(getObject(arg1), ["uint16","uint32",][arg2], arg3, arg4);
    };
    imports.wbg.__wbg_setVertexBuffer_c347f9618d3f056a = function(arg0, arg1, arg2, arg3) {
        getObject(arg0).setVertexBuffer(arg1 >>> 0, getObject(arg2), arg3);
    };
    imports.wbg.__wbg_setVertexBuffer_40da6368898587db = function(arg0, arg1, arg2, arg3, arg4) {
        getObject(arg0).setVertexBuffer(arg1 >>> 0, getObject(arg2), arg3, arg4);
    };
    imports.wbg.__wbg_draw_a3e2be7a25d4af68 = function(arg0, arg1, arg2, arg3, arg4) {
        getObject(arg0).draw(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4 >>> 0);
    };
    imports.wbg.__wbg_drawIndexed_f219cccc74b869c5 = function(arg0, arg1, arg2, arg3, arg4, arg5) {
        getObject(arg0).drawIndexed(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4, arg5 >>> 0);
    };
    imports.wbg.__wbg_drawIndirect_23fc0a72c5f1b993 = function(arg0, arg1, arg2) {
        getObject(arg0).drawIndirect(getObject(arg1), arg2);
    };
    imports.wbg.__wbg_drawIndexedIndirect_6839c0505e2eed2e = function(arg0, arg1, arg2) {
        getObject(arg0).drawIndexedIndirect(getObject(arg1), arg2);
    };
    imports.wbg.__wbg_setBlendConstant_fd172910ef2cc0c8 = function(arg0, arg1) {
        getObject(arg0).setBlendConstant(getObject(arg1));
    };
    imports.wbg.__wbg_setScissorRect_915b4534e3936f28 = function(arg0, arg1, arg2, arg3, arg4) {
        getObject(arg0).setScissorRect(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4 >>> 0);
    };
    imports.wbg.__wbg_setViewport_aff318ede051c64e = function(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
        getObject(arg0).setViewport(arg1, arg2, arg3, arg4, arg5, arg6);
    };
    imports.wbg.__wbg_setStencilReference_e2bb05496423e92e = function(arg0, arg1) {
        getObject(arg0).setStencilReference(arg1 >>> 0);
    };
    imports.wbg.__wbg_executeBundles_0f6b9b3accb5b6a7 = function(arg0, arg1) {
        getObject(arg0).executeBundles(getObject(arg1));
    };
    imports.wbg.__wbg_end_c97b7dbccda72e72 = function(arg0) {
        getObject(arg0).end();
    };
    imports.wbg.__wbg_submit_4283b63806c5d15e = function(arg0, arg1) {
        getObject(arg0).submit(getObject(arg1));
    };
    imports.wbg.__wbg_lineNum_06a4c70c1027df81 = function(arg0) {
        const ret = getObject(arg0).lineNum;
        return ret;
    };
    imports.wbg.__wbg_message_0ff806941d54e1d2 = function(arg0, arg1) {
        const ret = getObject(arg1).message;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_queueMicrotask_48421b3cc9052b68 = function(arg0) {
        const ret = getObject(arg0).queueMicrotask;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_queueMicrotask_12a30234db4045d3 = function(arg0) {
        queueMicrotask(getObject(arg0));
    };
    imports.wbg.__wbg_instanceof_Window_5012736c80a01584 = function(arg0) {
        let result;
        try {
            result = getObject(arg0) instanceof Window;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_document_8554450897a855b9 = function(arg0) {
        const ret = getObject(arg0).document;
        return isLikeNone(ret) ? 0 : addHeapObject(ret);
    };
    imports.wbg.__wbg_navigator_6210380287bf8581 = function(arg0) {
        const ret = getObject(arg0).navigator;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_performance_fa12dc8712926291 = function(arg0) {
        const ret = getObject(arg0).performance;
        return isLikeNone(ret) ? 0 : addHeapObject(ret);
    };
    imports.wbg.__wbg_getElementById_f56c8e6a15a6926d = function(arg0, arg1, arg2) {
        const ret = getObject(arg0).getElementById(getStringFromWasm0(arg1, arg2));
        return isLikeNone(ret) ? 0 : addHeapObject(ret);
    };
    imports.wbg.__wbg_querySelectorAll_52447cbab6df8bae = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = getObject(arg0).querySelectorAll(getStringFromWasm0(arg1, arg2));
        return addHeapObject(ret);
    }, arguments) };
    imports.wbg.__wbg_navigator_db73b5b11a0c5c93 = function(arg0) {
        const ret = getObject(arg0).navigator;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_instanceof_CanvasRenderingContext2d_a0c4f0da6392b8ca = function(arg0) {
        let result;
        try {
            result = getObject(arg0) instanceof CanvasRenderingContext2D;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_canvas_5f9a5cbf64ebed8f = function(arg0) {
        const ret = getObject(arg0).canvas;
        return isLikeNone(ret) ? 0 : addHeapObject(ret);
    };
    imports.wbg.__wbg_setfillStyle_98060f7b257936ba = function(arg0, arg1) {
        getObject(arg0).fillStyle = getObject(arg1);
    };
    imports.wbg.__wbg_beginPath_46864742afca3d8a = function(arg0) {
        getObject(arg0).beginPath();
    };
    imports.wbg.__wbg_fill_e279a178cb36bb43 = function(arg0) {
        getObject(arg0).fill();
    };
    imports.wbg.__wbg_getImageData_dafed2a124c5f03f = function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
        const ret = getObject(arg0).getImageData(arg1, arg2, arg3, arg4);
        return addHeapObject(ret);
    }, arguments) };
    imports.wbg.__wbg_putImageData_d8c261486f99879a = function() { return handleError(function (arg0, arg1, arg2, arg3) {
        getObject(arg0).putImageData(getObject(arg1), arg2, arg3);
    }, arguments) };
    imports.wbg.__wbg_closePath_b417e91d179f99c7 = function(arg0) {
        getObject(arg0).closePath();
    };
    imports.wbg.__wbg_lineTo_d568f4e620652516 = function(arg0, arg1, arg2) {
        getObject(arg0).lineTo(arg1, arg2);
    };
    imports.wbg.__wbg_moveTo_c946166c812bd616 = function(arg0, arg1, arg2) {
        getObject(arg0).moveTo(arg1, arg2);
    };
    imports.wbg.__wbg_fillRect_a5a5da573f0412b5 = function(arg0, arg1, arg2, arg3, arg4) {
        getObject(arg0).fillRect(arg1, arg2, arg3, arg4);
    };
    imports.wbg.__wbg_instanceof_HtmlCanvasElement_1a96a01603ec2d8b = function(arg0) {
        let result;
        try {
            result = getObject(arg0) instanceof HTMLCanvasElement;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_width_53a5bd0268e99485 = function(arg0) {
        const ret = getObject(arg0).width;
        return ret;
    };
    imports.wbg.__wbg_setwidth_e371a8d6b16ebe84 = function(arg0, arg1) {
        getObject(arg0).width = arg1 >>> 0;
    };
    imports.wbg.__wbg_height_6fb32e51e54037ae = function(arg0) {
        const ret = getObject(arg0).height;
        return ret;
    };
    imports.wbg.__wbg_setheight_ba99ad2df4295e89 = function(arg0, arg1) {
        getObject(arg0).height = arg1 >>> 0;
    };
    imports.wbg.__wbg_getContext_69ec873410cbba3c = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = getObject(arg0).getContext(getStringFromWasm0(arg1, arg2));
        return isLikeNone(ret) ? 0 : addHeapObject(ret);
    }, arguments) };
    imports.wbg.__wbg_getContext_70d493702d2b8f3e = function() { return handleError(function (arg0, arg1, arg2, arg3) {
        const ret = getObject(arg0).getContext(getStringFromWasm0(arg1, arg2), getObject(arg3));
        return isLikeNone(ret) ? 0 : addHeapObject(ret);
    }, arguments) };
    imports.wbg.__wbg_get_fe289e3950b3978a = function(arg0, arg1) {
        const ret = getObject(arg0)[arg1 >>> 0];
        return isLikeNone(ret) ? 0 : addHeapObject(ret);
    };
    imports.wbg.__wbg_debug_5a33c41aeac15ee6 = function(arg0) {
        console.debug(getObject(arg0));
    };
    imports.wbg.__wbg_error_09480e4aadca50ad = function(arg0) {
        console.error(getObject(arg0));
    };
    imports.wbg.__wbg_info_c261acb2deacd903 = function(arg0) {
        console.info(getObject(arg0));
    };
    imports.wbg.__wbg_log_b103404cc5920657 = function(arg0) {
        console.log(getObject(arg0));
    };
    imports.wbg.__wbg_timeEnd_6312aef95ba5ec58 = function(arg0, arg1) {
        console.timeEnd(getStringFromWasm0(arg0, arg1));
    };
    imports.wbg.__wbg_warn_2b3adb99ce26c314 = function(arg0) {
        console.warn(getObject(arg0));
    };
    imports.wbg.__wbg_setwidth_c20f1f8fcd5d93b4 = function(arg0, arg1) {
        getObject(arg0).width = arg1 >>> 0;
    };
    imports.wbg.__wbg_setheight_a5e39c9d97429299 = function(arg0, arg1) {
        getObject(arg0).height = arg1 >>> 0;
    };
    imports.wbg.__wbg_getContext_bd2ece8a59fd4732 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = getObject(arg0).getContext(getStringFromWasm0(arg1, arg2));
        return isLikeNone(ret) ? 0 : addHeapObject(ret);
    }, arguments) };
    imports.wbg.__wbg_now_a69647afb1f66247 = function(arg0) {
        const ret = getObject(arg0).now();
        return ret;
    };
    imports.wbg.__wbg_data_3748d6414e549999 = function(arg0, arg1) {
        const ret = getObject(arg1).data;
        const ptr1 = passArray8ToWasm0(ret, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_newwithu8clampedarrayandsh_aa7545d0ba5b755e = function() { return handleError(function (arg0, arg1, arg2, arg3) {
        const ret = new ImageData(getClampedArrayU8FromWasm0(arg0, arg1), arg2 >>> 0, arg3 >>> 0);
        return addHeapObject(ret);
    }, arguments) };
    imports.wbg.__wbg_get_3baa728f9d58d3f6 = function(arg0, arg1) {
        const ret = getObject(arg0)[arg1 >>> 0];
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_length_ae22078168b726f5 = function(arg0) {
        const ret = getObject(arg0).length;
        return ret;
    };
    imports.wbg.__wbg_new_a220cf903aa02ca2 = function() {
        const ret = new Array();
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_newnoargs_76313bd6ff35d0f2 = function(arg0, arg1) {
        const ret = new Function(getStringFromWasm0(arg0, arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_call_1084a111329e68ce = function() { return handleError(function (arg0, arg1) {
        const ret = getObject(arg0).call(getObject(arg1));
        return addHeapObject(ret);
    }, arguments) };
    imports.wbg.__wbg_new_525245e2b9901204 = function() {
        const ret = new Object();
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_self_3093d5d1f7bcb682 = function() { return handleError(function () {
        const ret = self.self;
        return addHeapObject(ret);
    }, arguments) };
    imports.wbg.__wbg_window_3bcfc4d31bc012f8 = function() { return handleError(function () {
        const ret = window.window;
        return addHeapObject(ret);
    }, arguments) };
    imports.wbg.__wbg_globalThis_86b222e13bdf32ed = function() { return handleError(function () {
        const ret = globalThis.globalThis;
        return addHeapObject(ret);
    }, arguments) };
    imports.wbg.__wbg_global_e5a3fe56f8be9485 = function() { return handleError(function () {
        const ret = global.global;
        return addHeapObject(ret);
    }, arguments) };
    imports.wbg.__wbg_push_37c89022f34c01ca = function(arg0, arg1) {
        const ret = getObject(arg0).push(getObject(arg1));
        return ret;
    };
    imports.wbg.__wbg_call_89af060b4e1523f2 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = getObject(arg0).call(getObject(arg1), getObject(arg2));
        return addHeapObject(ret);
    }, arguments) };
    imports.wbg.__wbg_instanceof_Object_b80213ae6cc9aafb = function(arg0) {
        let result;
        try {
            result = getObject(arg0) instanceof Object;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_valueOf_d5ba0a54a2aa5615 = function(arg0) {
        const ret = getObject(arg0).valueOf();
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_new_b85e72ed1bfd57f9 = function(arg0, arg1) {
        try {
            var state0 = {a: arg0, b: arg1};
            var cb0 = (arg0, arg1) => {
                const a = state0.a;
                state0.a = 0;
                try {
                    return __wbg_adapter_445(a, state0.b, arg0, arg1);
                } finally {
                    state0.a = a;
                }
            };
            const ret = new Promise(cb0);
            return addHeapObject(ret);
        } finally {
            state0.a = state0.b = 0;
        }
    };
    imports.wbg.__wbg_resolve_570458cb99d56a43 = function(arg0) {
        const ret = Promise.resolve(getObject(arg0));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_then_95e6edc0f89b73b1 = function(arg0, arg1) {
        const ret = getObject(arg0).then(getObject(arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_then_876bb3c633745cc6 = function(arg0, arg1, arg2) {
        const ret = getObject(arg0).then(getObject(arg1), getObject(arg2));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_buffer_b7b08af79b0b0974 = function(arg0) {
        const ret = getObject(arg0).buffer;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_newwithbyteoffsetandlength_8a2cb9ca96b27ec9 = function(arg0, arg1, arg2) {
        const ret = new Uint8Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_new_ea1883e1e5e86686 = function(arg0) {
        const ret = new Uint8Array(getObject(arg0));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_set_d1e79e2388520f18 = function(arg0, arg1, arg2) {
        getObject(arg0).set(getObject(arg1), arg2 >>> 0);
    };
    imports.wbg.__wbg_length_8339fcf5d8ecd12e = function(arg0) {
        const ret = getObject(arg0).length;
        return ret;
    };
    imports.wbg.__wbg_newwithlength_ec548f448387c968 = function(arg0) {
        const ret = new Uint8Array(arg0 >>> 0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_buffer_0710d1b9dbe2eea6 = function(arg0) {
        const ret = getObject(arg0).buffer;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_subarray_7c2e3576afe181d1 = function(arg0, arg1, arg2) {
        const ret = getObject(arg0).subarray(arg1 >>> 0, arg2 >>> 0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_set_eacc7d73fefaafdf = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = Reflect.set(getObject(arg0), getObject(arg1), getObject(arg2));
        return ret;
    }, arguments) };
    imports.wbg.__wbindgen_debug_string = function(arg0, arg1) {
        const ret = debugString(getObject(arg1));
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };
    imports.wbg.__wbindgen_memory = function() {
        const ret = wasm.memory;
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_closure_wrapper1093 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 369, __wbg_adapter_30);
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_closure_wrapper1095 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 369, __wbg_adapter_30);
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_closure_wrapper1333 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 380, __wbg_adapter_35);
        return addHeapObject(ret);
    };

    return imports;
}

function __wbg_init_memory(imports, memory) {

}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedDataViewMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    cachedUint8ClampedArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined' && Object.getPrototypeOf(module) === Object.prototype)
    ({module} = module)
    else
    console.warn('using deprecated parameters for `initSync()`; pass a single object instead')

    const imports = __wbg_get_imports();

    __wbg_init_memory(imports);

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined' && Object.getPrototypeOf(module_or_path) === Object.prototype)
    ({module_or_path} = module_or_path)
    else
    console.warn('using deprecated parameters for the initialization function; pass a single object instead')

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('renderer_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    __wbg_init_memory(imports);

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
