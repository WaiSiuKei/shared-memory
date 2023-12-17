// @ts-ignore
import moduleFactory from './binding.js';

// @ts-ignore
import wasmURL from './binding.wasm?url';
import Worker from './worker?worker';

async function main() {

    var TOTAL_MEMORY = 16777216;
    var WASM_PAGE_SIZE = 65536;
    var wasmMemory = new WebAssembly.Memory({
        'initial': TOTAL_MEMORY / WASM_PAGE_SIZE,
        'maximum': TOTAL_MEMORY / WASM_PAGE_SIZE,
        shared: true,
    });
    var buffer = wasmMemory.buffer;
    let wasm: any;
    const Module = {
        async instantiateWasm(info: any, receiveInstance: any) {
            var importObject = Object.assign({}, info);
            importObject['env']['memory'] = wasmMemory;
            const output = await WebAssembly.instantiateStreaming(fetch(wasmURL, { credentials: 'same-origin' }), importObject);
            wasm = output;
            return receiveInstance(output['instance']);
        },
        TOTAL_MEMORY,
        buffer,
    } as any;
    const module = await moduleFactory(Module);
    {
        // 创建一个包含数据的Uint8Array
        const uint8Array = new Uint8Array([1, 2, 3, 4, 5]);

        // 获取WebAssembly线性内存的引用
        const wasmMemory = module.HEAPU8.buffer;

        // 创建一个内存视图来读写WebAssembly线性内存中的数据
        const memoryView = new Uint8Array(wasmMemory);

        // 将Uint8Array的数据直接复制到内存视图
        memoryView.set(uint8Array);

        // 调用WebAssembly模块中的函数来修改数据
        module.modify(memoryView.byteOffset, uint8Array.length);

        // 从内存视图中读取修改后的数据
        // var modifiedData = new Uint8Array(wasmMemory, memoryView.byteOffset, uint8Array.length);
    }

    const worker = new Worker();
    worker.postMessage({
        method: 'init',
        wasm: wasm.instance.exports,
    });

    worker.onmessage = (e) => {
        if (e.data.inited) {

            console.log(module.getSize());
            // var ptr = module._malloc(1 * 10);
            //
            // module.allocate(ptr);
            // console.log('main', module.read(ptr), module.HEAP8[ptr]);

            worker.postMessage({
                method: 'call',
            });
        }
    };
}

main();
