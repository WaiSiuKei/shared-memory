import moduleFactory from './binding.js';

let module;
self.onmessage = async e => {
    switch (e.data.method) {
        case 'init': {
            const {
                wasmMemory,
                wasmModule
            } = e.data;

            const Module = {
                wasmMemory,
                async instantiateWasm(info: any, receiveInstance: any) {
                    var instance = new WebAssembly.Instance(wasmModule, info);
                    receiveInstance(instance, wasmModule);
                    return instance.exports;
                },
            } as any;
            module = await moduleFactory(Module);
            console.log(module);
            self.postMessage({
                inited: true
            });
            break;
        }
        case 'call': {
            const { ptr } = e.data;
            console.log(module.getDataFromAddress(ptr));
        }
    }
};

