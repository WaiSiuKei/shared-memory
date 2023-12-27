# Shared Memory

An experimental project aimed at exploring the utilization of shared memory between the main browser thread and worker thread.

## How to do it
1. Export C++ bindings to JS via a WASM module.
2. Load the WASM code and initialize the WASM module with shared WebAssembly Memory in the main thread.
3. Send the WASM module and WebAssembly Memory to a worker thread.
4. Initialize another WASM module using the data sent by the main thread.
5. Manipulate shared memory with JS API.
