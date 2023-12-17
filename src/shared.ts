import workerModuleFactory from './worker-wasm';
import workerWasmURL from './worker-wasm.wasm?url';

async function main() {
    const Module = {
        async instantiateWasm(info: any, receiveInstance: any) {
            var importObject = Object.assign({}, info);
            const output = await WebAssembly.instantiateStreaming(fetch(workerWasmURL, { credentials: 'same-origin' }), importObject);
            receiveInstance(output['instance'], output.module);
            return output.instance.exports;
        },
    } as any;
    const module = await workerModuleFactory(Module);

    const worker = module.$$worker;
    worker.addEventListener('message', (e) => {
        if (e.data.inited) {
            // 创建一个包含数据的Uint8Array
            const uint8Array = new Uint8Array([1, 2, 3, 4, 5]);

            // 获取WebAssembly线性内存的引用
            const wasmMemory = module.HEAPU8.buffer;

            // 创建一个内存视图来读写WebAssembly线性内存中的数据
            const memoryView = new Uint8Array(wasmMemory);

            // 将Uint8Array的数据直接复制到内存视图
            memoryView.set(uint8Array);

            // 调用WebAssembly模块中的函数来修改数据
            // module.modify(memoryView.byteOffset, uint8Array.length);
            memoryView[0] = 2
            memoryView[1] = 4
            memoryView[2] = 6

            // 从内存视图中读取修改后的数据
            var modifiedData = new Uint8Array(wasmMemory, memoryView.byteOffset, uint8Array.length);
            console.log(module);
            console.log(modifiedData);
            worker.postMessage({
                call: true,
            });
        }
    });
}

main();
