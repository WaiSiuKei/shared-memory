import moduleFactory from './worker-wasm';

let module: any;
onmessage = async function ({ data }) {
    if (data.$ww) {
        const d = data;
        d['instantiateWasm'] = async (info, receiveInstance) => {
            var instance = new WebAssembly.Instance(d['wasm'], info);
            receiveInstance(instance, d['wasm']);
            return instance.exports;
            // var importObject = Object.assign({}, info);
            // importObject['env']['memory'] = d.wasmMemory;
            // const output = await WebAssembly.instantiateStreaming(fetch(wasmURL, { credentials: 'same-origin' }), importObject);
            // receiveInstance(output['instance']);
            // console.log(output);
            // return output.instance.exports;
        };
        module = await moduleFactory(d);
        postMessage({
            inited: true,
        });
        return;
    }
    if (data.call) {
        // 获取WebAssembly线性内存的引用
        const wasmMemory = module.HEAPU8.buffer;

        // 创建一个内存视图来读写WebAssembly线性内存中的数据
        const memoryView = new Uint8Array(wasmMemory);

        const uint8Array = new Uint8Array([1, 2, 3, 4, 5]);

        // 从内存视图中读取修改后的数据
        var modifiedData = new Uint8Array(wasmMemory, memoryView.byteOffset, uint8Array.length);
        console.log(modifiedData);
    }
};
