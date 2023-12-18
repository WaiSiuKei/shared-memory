// @ts-ignore
import moduleFactory from './binding.js';

// @ts-ignore
import wasmURL from './binding.wasm?url';
import Worker from './worker?worker';

async function main() {
    let wasmModule;
    const Module = {
        async instantiateWasm(info: any, receiveInstance: any) {
            var importObject = Object.assign({}, info);
            const output = await WebAssembly.instantiateStreaming(fetch(wasmURL, { credentials: 'same-origin' }), importObject);
            wasmModule = output.module;
            const instance = output.instance;
            return receiveInstance(instance, wasmModule);
        },
    } as any;
    const module = await moduleFactory(Module);
    const worker = new Worker();
    worker.postMessage({
        method: 'init',
        wasmModule: wasmModule,
        wasmMemory: module.wasmMemory,
    });

    worker.onmessage = (e) => {
        if (e.data.inited) {
            const obj = new module.MyClass();
            obj.data = 123;
            const ptr = module.getAddress(obj);

            worker.postMessage({
                method: 'call',
                ptr,
            });
        }
    };
}

main();
