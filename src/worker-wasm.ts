import SharedMemoryWorker from './worker-wasm.ww?worker'

var Module = (() => {
  var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;

  return (
    function (Module) {
      Module = Module || {};

      var Module = typeof Module != 'undefined' ? Module : {};
      var readyPromiseResolve, readyPromiseReject;
      Module['ready'] = new Promise(function (resolve, reject) {
        readyPromiseResolve = resolve;
        readyPromiseReject = reject;
      });
      var moduleOverrides = Object.assign({}, Module);
      var arguments_ = [];
      var thisProgram = './this.program';
      var quit_ = (status, toThrow) => {throw toThrow;};
      var ENVIRONMENT_IS_WEB = false;
      var ENVIRONMENT_IS_WORKER = true;
      var ENVIRONMENT_IS_NODE = false;
      var ENVIRONMENT_IS_WASM_WORKER = Module['$ww'];
      var scriptDirectory = '';

      function locateFile(path) {
        if (Module['locateFile']) {return Module['locateFile'](path, scriptDirectory);}
        return scriptDirectory + path;
      }

      var read_, readAsync, readBinary, setWindowTitle;
      if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
        if (ENVIRONMENT_IS_WORKER) {scriptDirectory = self.location.href;} else if (typeof document != 'undefined' && document.currentScript) {scriptDirectory = document.currentScript.src;}
        if (_scriptDir) {scriptDirectory = _scriptDir;}
        if (scriptDirectory.indexOf('blob:') !== 0) {scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, '').lastIndexOf('/') + 1);} else {scriptDirectory = '';}
        {
          read_ = url => {
            var xhr = new XMLHttpRequest;
            xhr.open('GET', url, false);
            xhr.send(null);
            return xhr.responseText;
          };
          if (ENVIRONMENT_IS_WORKER) {
            readBinary = url => {
              var xhr = new XMLHttpRequest;
              xhr.open('GET', url, false);
              xhr.responseType = 'arraybuffer';
              xhr.send(null);
              return new Uint8Array(xhr.response);
            };
          }
          readAsync = (url, onload, onerror) => {
            var xhr = new XMLHttpRequest;
            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = () => {
              if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                onload(xhr.response);
                return;
              }
              onerror();
            };
            xhr.onerror = onerror;
            xhr.send(null);
          };
        }
        setWindowTitle = title => document.title = title;
      } else {}
      var out = Module['print'] || console.log.bind(console);
      var err = Module['printErr'] || console.warn.bind(console);
      Object.assign(Module, moduleOverrides);
      moduleOverrides = null;
      if (Module['arguments']) arguments_ = Module['arguments'];
      if (Module['thisProgram']) thisProgram = Module['thisProgram'];
      if (Module['quit']) quit_ = Module['quit'];
      var POINTER_SIZE = 4;

      function warnOnce(text) {
        if (!warnOnce.shown) warnOnce.shown = {};
        if (!warnOnce.shown[text]) {
          warnOnce.shown[text] = 1;
          err(text);
        }
      }

      function uleb128Encode(n) {
        if (n < 128) {return [n];}
        return [n % 128 | 128, n >> 7];
      }

      function sigToWasmTypes(sig) {
        var typeNames = { 'i': 'i32', 'j': 'i64', 'f': 'f32', 'd': 'f64', 'p': 'i32' };
        var type = { parameters: [], results: sig[0] == 'v' ? [] : [typeNames[sig[0]]] };
        for (var i = 1; i < sig.length; ++i) {type.parameters.push(typeNames[sig[i]]);}
        return type;
      }

      function convertJsFunctionToWasm(func, sig) {
        if (typeof WebAssembly.Function == 'function') {return new WebAssembly.Function(sigToWasmTypes(sig), func);}
        var typeSection = [1, 96];
        var sigRet = sig.slice(0, 1);
        var sigParam = sig.slice(1);
        var typeCodes = { 'i': 127, 'p': 127, 'j': 126, 'f': 125, 'd': 124 };
        typeSection = typeSection.concat(uleb128Encode(sigParam.length));
        for (var i = 0; i < sigParam.length; ++i) {typeSection.push(typeCodes[sigParam[i]]);}
        if (sigRet == 'v') {typeSection.push(0);} else {typeSection = typeSection.concat([1, typeCodes[sigRet]]);}
        typeSection = [1].concat(uleb128Encode(typeSection.length), typeSection);
        var bytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0].concat(typeSection, [2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0]));
        var module = new WebAssembly.Module(bytes);
        var instance = new WebAssembly.Instance(module, { 'e': { 'f': func } });
        var wrappedFunc = instance.exports['f'];
        return wrappedFunc;
      }

      var freeTableIndexes = [];
      var functionsInTableMap;

      function getEmptyTableSlot() {
        if (freeTableIndexes.length) {return freeTableIndexes.pop();}
        try {wasmTable.grow(1);} catch (err) {
          if (!(err instanceof RangeError)) {throw err;}
          throw'Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.';
        }
        return wasmTable.length - 1;
      }

      function updateTableMap(offset, count) {
        for (var i = offset; i < offset + count; i++) {
          var item = getWasmTableEntry(i);
          if (item) {functionsInTableMap.set(item, i);}
        }
      }

      var tempRet0 = 0;
      var setTempRet0 = value => {tempRet0 = value;};
      var wasmBinary;
      if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];
      var noExitRuntime = Module['noExitRuntime'] || true;
      if (typeof WebAssembly != 'object') {abort('no native wasm support detected');}
      var wasmMemory;
      var wasmModule;
      var ABORT = false;
      var EXITSTATUS;

      function assert(condition, text) {if (!condition) {abort(text);}}

      function getCFunc(ident) {
        var func = Module['_' + ident];
        return func;
      }

      function ccall(ident, returnType, argTypes, args, opts) {
        var toC = {
          'string': function (str) {
            var ret = 0;
            if (str !== null && str !== undefined && str !== 0) {
              var len = (str.length << 2) + 1;
              ret = stackAlloc(len);
              stringToUTF8(str, ret, len);
            }
            return ret;
          }, 'array': function (arr) {
            var ret = stackAlloc(arr.length);
            writeArrayToMemory(arr, ret);
            return ret;
          }
        };

        function convertReturnValue(ret) {
          if (returnType === 'string') {return UTF8ToString(ret);}
          if (returnType === 'boolean') return Boolean(ret);
          return ret;
        }

        var func = getCFunc(ident);
        var cArgs = [];
        var stack = 0;
        if (args) {
          for (var i = 0; i < args.length; i++) {
            var converter = toC[argTypes[i]];
            if (converter) {
              if (stack === 0) stack = stackSave();
              cArgs[i] = converter(args[i]);
            } else {cArgs[i] = args[i];}
          }
        }
        var ret = func.apply(null, cArgs);

        function onDone(ret) {
          if (stack !== 0) stackRestore(stack);
          return convertReturnValue(ret);
        }

        ret = onDone(ret);
        return ret;
      }

      var ALLOC_STACK = 1;
      var UTF8Decoder = typeof TextDecoder != 'undefined' ? new TextDecoder('utf8') : undefined;

      function UTF8ArrayToString(heapOrArray, idx, maxBytesToRead) {
        var endIdx = idx + maxBytesToRead;
        var endPtr = idx;
        while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
        if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {return UTF8Decoder.decode(heapOrArray.buffer instanceof SharedArrayBuffer ? heapOrArray.slice(idx, endPtr) : heapOrArray.subarray(idx, endPtr));} else {
          var str = '';
          while (idx < endPtr) {
            var u0 = heapOrArray[idx++];
            if (!(u0 & 128)) {
              str += String.fromCharCode(u0);
              continue;
            }
            var u1 = heapOrArray[idx++] & 63;
            if ((u0 & 224) == 192) {
              str += String.fromCharCode((u0 & 31) << 6 | u1);
              continue;
            }
            var u2 = heapOrArray[idx++] & 63;
            if ((u0 & 240) == 224) {u0 = (u0 & 15) << 12 | u1 << 6 | u2;} else {u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heapOrArray[idx++] & 63;}
            if (u0 < 65536) {str += String.fromCharCode(u0);} else {
              var ch = u0 - 65536;
              str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
            }
          }
        }
        return str;
      }

      function UTF8ToString(ptr, maxBytesToRead) {return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';}

      function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
        if (!(maxBytesToWrite > 0)) return 0;
        var startIdx = outIdx;
        var endIdx = outIdx + maxBytesToWrite - 1;
        for (var i = 0; i < str.length; ++i) {
          var u = str.charCodeAt(i);
          if (u >= 55296 && u <= 57343) {
            var u1 = str.charCodeAt(++i);
            u = 65536 + ((u & 1023) << 10) | u1 & 1023;
          }
          if (u <= 127) {
            if (outIdx >= endIdx) break;
            heap[outIdx++] = u;
          } else if (u <= 2047) {
            if (outIdx + 1 >= endIdx) break;
            heap[outIdx++] = 192 | u >> 6;
            heap[outIdx++] = 128 | u & 63;
          } else if (u <= 65535) {
            if (outIdx + 2 >= endIdx) break;
            heap[outIdx++] = 224 | u >> 12;
            heap[outIdx++] = 128 | u >> 6 & 63;
            heap[outIdx++] = 128 | u & 63;
          } else {
            if (outIdx + 3 >= endIdx) break;
            heap[outIdx++] = 240 | u >> 18;
            heap[outIdx++] = 128 | u >> 12 & 63;
            heap[outIdx++] = 128 | u >> 6 & 63;
            heap[outIdx++] = 128 | u & 63;
          }
        }
        heap[outIdx] = 0;
        return outIdx - startIdx;
      }

      function stringToUTF8(str, outPtr, maxBytesToWrite) {return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);}

      function lengthBytesUTF8(str) {
        var len = 0;
        for (var i = 0; i < str.length; ++i) {
          var u = str.charCodeAt(i);
          if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
          if (u <= 127) ++len; else if (u <= 2047) len += 2; else if (u <= 65535) len += 3; else len += 4;
        }
        return len;
      }

      var UTF16Decoder = typeof TextDecoder != 'undefined' ? new TextDecoder('utf-16le') : undefined;

      function UTF16ToString(ptr, maxBytesToRead) {
        var endPtr = ptr;
        var idx = endPtr >> 1;
        var maxIdx = idx + maxBytesToRead / 2;
        while (!(idx >= maxIdx) && HEAPU16[idx]) ++idx;
        endPtr = idx << 1;
        if (endPtr - ptr > 32 && UTF16Decoder) {return UTF16Decoder.decode(HEAPU8.slice(ptr, endPtr));} else {
          var str = '';
          for (var i = 0; !(i >= maxBytesToRead / 2); ++i) {
            var codeUnit = HEAP16[ptr + i * 2 >> 1];
            if (codeUnit == 0) break;
            str += String.fromCharCode(codeUnit);
          }
          return str;
        }
      }

      function stringToUTF16(str, outPtr, maxBytesToWrite) {
        if (maxBytesToWrite === undefined) {maxBytesToWrite = 2147483647;}
        if (maxBytesToWrite < 2) return 0;
        maxBytesToWrite -= 2;
        var startPtr = outPtr;
        var numCharsToWrite = maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
        for (var i = 0; i < numCharsToWrite; ++i) {
          var codeUnit = str.charCodeAt(i);
          HEAP16[outPtr >> 1] = codeUnit;
          outPtr += 2;
        }
        HEAP16[outPtr >> 1] = 0;
        return outPtr - startPtr;
      }

      function lengthBytesUTF16(str) {return str.length * 2;}

      function UTF32ToString(ptr, maxBytesToRead) {
        var i = 0;
        var str = '';
        while (!(i >= maxBytesToRead / 4)) {
          var utf32 = HEAP32[ptr + i * 4 >> 2];
          if (utf32 == 0) break;
          ++i;
          if (utf32 >= 65536) {
            var ch = utf32 - 65536;
            str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
          } else {str += String.fromCharCode(utf32);}
        }
        return str;
      }

      function stringToUTF32(str, outPtr, maxBytesToWrite) {
        if (maxBytesToWrite === undefined) {maxBytesToWrite = 2147483647;}
        if (maxBytesToWrite < 4) return 0;
        var startPtr = outPtr;
        var endPtr = startPtr + maxBytesToWrite - 4;
        for (var i = 0; i < str.length; ++i) {
          var codeUnit = str.charCodeAt(i);
          if (codeUnit >= 55296 && codeUnit <= 57343) {
            var trailSurrogate = str.charCodeAt(++i);
            codeUnit = 65536 + ((codeUnit & 1023) << 10) | trailSurrogate & 1023;
          }
          HEAP32[outPtr >> 2] = codeUnit;
          outPtr += 4;
          if (outPtr + 4 > endPtr) break;
        }
        HEAP32[outPtr >> 2] = 0;
        return outPtr - startPtr;
      }

      function lengthBytesUTF32(str) {
        var len = 0;
        for (var i = 0; i < str.length; ++i) {
          var codeUnit = str.charCodeAt(i);
          if (codeUnit >= 55296 && codeUnit <= 57343) ++i;
          len += 4;
        }
        return len;
      }

      function writeArrayToMemory(array, buffer) {HEAP8.set(array, buffer);}

      function writeAsciiToMemory(str, buffer, dontAddNull) {
        for (var i = 0; i < str.length; ++i) {HEAP8[buffer++ >> 0] = str.charCodeAt(i);}
        if (!dontAddNull) HEAP8[buffer >> 0] = 0;
      }

      var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

      function updateGlobalBufferAndViews(buf) {
        buffer = buf;
        Module['HEAP8'] = HEAP8 = new Int8Array(buf);
        Module['HEAP16'] = HEAP16 = new Int16Array(buf);
        Module['HEAP32'] = HEAP32 = new Int32Array(buf);
        Module['HEAPU8'] = HEAPU8 = new Uint8Array(buf);
        Module['HEAPU16'] = HEAPU16 = new Uint16Array(buf);
        Module['HEAPU32'] = HEAPU32 = new Uint32Array(buf);
        Module['HEAPF32'] = HEAPF32 = new Float32Array(buf);
        Module['HEAPF64'] = HEAPF64 = new Float64Array(buf);
      }

      var INITIAL_MEMORY = Module['INITIAL_MEMORY'] || 16777216;
      if (Module['wasmMemory']) {wasmMemory = Module['wasmMemory'];} else {
        wasmMemory = new WebAssembly.Memory({ 'initial': INITIAL_MEMORY / 65536, 'maximum': INITIAL_MEMORY / 65536, 'shared': true });
        if (!(wasmMemory.buffer instanceof SharedArrayBuffer)) {
          err('requested a shared WebAssembly.Memory but the returned buffer is not a SharedArrayBuffer, indicating that while the browser has SharedArrayBuffer it does not have WebAssembly threads support - you may need to set a flag');
          if (ENVIRONMENT_IS_NODE) {console.log('(on node you may need: --experimental-wasm-threads --experimental-wasm-bulk-memory and also use a recent version)');}
          throw Error('bad memory');
        }
      }
      if (wasmMemory) {buffer = wasmMemory.buffer;}
      INITIAL_MEMORY = buffer.byteLength;
      updateGlobalBufferAndViews(buffer);
      var wasmTable;
      var __ATPRERUN__ = [];
      var __ATINIT__ = [];
      var __ATMAIN__ = [];
      var __ATPOSTRUN__ = [];
      var runtimeInitialized = false;

      function keepRuntimeAlive() {return noExitRuntime;}

      function preRun() {
        if (Module['preRun']) {
          if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
          while (Module['preRun'].length) {addOnPreRun(Module['preRun'].shift());}
        }
        callRuntimeCallbacks(__ATPRERUN__);
      }

      function initRuntime() {
        runtimeInitialized = true;
        if (ENVIRONMENT_IS_WASM_WORKER) return __wasm_worker_initializeRuntime();
        callRuntimeCallbacks(__ATINIT__);
      }

      function preMain() {callRuntimeCallbacks(__ATMAIN__);}

      function postRun() {
        if (Module['postRun']) {
          if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
          while (Module['postRun'].length) {addOnPostRun(Module['postRun'].shift());}
        }
        callRuntimeCallbacks(__ATPOSTRUN__);
      }

      function addOnPreRun(cb) {__ATPRERUN__.unshift(cb);}

      function addOnInit(cb) {__ATINIT__.unshift(cb);}

      function addOnPostRun(cb) {__ATPOSTRUN__.unshift(cb);}

      var runDependencies = 0;
      var runDependencyWatcher = null;
      var dependenciesFulfilled = null;

      function addRunDependency(id) {
        runDependencies++;
        if (Module['monitorRunDependencies']) {Module['monitorRunDependencies'](runDependencies);}
      }

      function removeRunDependency(id) {
        runDependencies--;
        if (Module['monitorRunDependencies']) {Module['monitorRunDependencies'](runDependencies);}
        if (runDependencies == 0) {
          if (runDependencyWatcher !== null) {
            clearInterval(runDependencyWatcher);
            runDependencyWatcher = null;
          }
          if (dependenciesFulfilled) {
            var callback = dependenciesFulfilled;
            dependenciesFulfilled = null;
            callback();
          }
        }
      }

      function abort(what) {
        {if (Module['onAbort']) {Module['onAbort'](what);}}
        what = 'Aborted(' + what + ')';
        err(what);
        ABORT = true;
        EXITSTATUS = 1;
        what += '. Build with -sASSERTIONS for more info.';
        var e = new WebAssembly.RuntimeError(what);
        readyPromiseReject(e);
        throw e;
      }

      var dataURIPrefix = 'data:application/octet-stream;base64,';

      function isDataURI(filename) {return filename.startsWith(dataURIPrefix);}

      var wasmBinaryFile;
      wasmBinaryFile = 'worker-wasm.wasm';
      if (!isDataURI(wasmBinaryFile)) {wasmBinaryFile = locateFile(wasmBinaryFile);}

      function getBinary(file) {
        try {
          if (file == wasmBinaryFile && wasmBinary) {return new Uint8Array(wasmBinary);}
          if (readBinary) {return readBinary(file);} else {throw'both async and sync fetching of the wasm failed';}
        } catch (err) {abort(err);}
      }

      function getBinaryPromise() {
        if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
          if (typeof fetch == 'function') {
            return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function (response) {
              if (!response['ok']) {throw'failed to load wasm binary file at \'' + wasmBinaryFile + '\'';}
              return response['arrayBuffer']();
            }).catch(function () {return getBinary(wasmBinaryFile);});
          }
        }
        return Promise.resolve().then(function () {return getBinary(wasmBinaryFile);});
      }

      function createWasm() {
        var info = { 'env': asmLibraryArg, 'wasi_snapshot_preview1': asmLibraryArg };

        function receiveInstance(instance, module) {
          var exports = instance.exports;
          Module['asm'] = exports;
          wasmTable = Module['asm']['__indirect_function_table'];
          addOnInit(Module['asm']['__wasm_call_ctors']);
          wasmModule = module;
          if (!ENVIRONMENT_IS_WASM_WORKER) {removeRunDependency('wasm-instantiate');}
        }

        if (!ENVIRONMENT_IS_WASM_WORKER) {addRunDependency('wasm-instantiate');}

        function receiveInstantiationResult(result) {receiveInstance(result['instance'], result['module']);}

        function instantiateArrayBuffer(receiver) {
          return getBinaryPromise().then(function (binary) {return WebAssembly.instantiate(binary, info);}).then(function (instance) {return instance;}).then(receiver, function (reason) {
            err('failed to asynchronously prepare wasm: ' + reason);
            abort(reason);
          });
        }

        function instantiateAsync() {
          if (!wasmBinary && typeof WebAssembly.instantiateStreaming == 'function' && !isDataURI(wasmBinaryFile) && typeof fetch == 'function') {
            return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function (response) {
              var result = WebAssembly.instantiateStreaming(response, info);
              return result.then(receiveInstantiationResult, function (reason) {
                err('wasm streaming compile failed: ' + reason);
                err('falling back to ArrayBuffer instantiation');
                return instantiateArrayBuffer(receiveInstantiationResult);
              });
            });
          } else {return instantiateArrayBuffer(receiveInstantiationResult);}
        }

        if (Module['instantiateWasm']) {
          try {
            var exports = Module['instantiateWasm'](info, receiveInstance);
            return exports;
          } catch (e) {
            err('Module.instantiateWasm callback failed with error: ' + e);
            return false;
          }
        }
        instantiateAsync().catch(readyPromiseReject);
        return {};
      }

      var tempDouble;
      var tempI64;
      var ASM_CONSTS = { 3956: () => {return wasmMemory.buffer instanceof SharedArrayBuffer;} };

      function callRuntimeCallbacks(callbacks) {while (callbacks.length > 0) {callbacks.shift()(Module);}}

      function demangle(func) {return func;}

      function demangleAll(text) {
        var regex = /\b_Z[\w\d_]+/g;
        return text.replace(regex, function (x) {
          var y = demangle(x);
          return x === y ? x : y + ' [' + x + ']';
        });
      }

      var wasmTableMirror = [];

      function getWasmTableEntry(funcPtr) {
        var func = wasmTableMirror[funcPtr];
        if (!func) {
          if (funcPtr >= wasmTableMirror.length) wasmTableMirror.length = funcPtr + 1;
          wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
        }
        return func;
      }

      function handleException(e) {
        if (e instanceof ExitStatus || e == 'unwind') {return EXITSTATUS;}
        quit_(1, e);
      }

      function jsStackTrace() {
        var error = new Error;
        if (!error.stack) {
          try {throw new Error;} catch (e) {error = e;}
          if (!error.stack) {return '(no stack trace available)';}
        }
        return error.stack.toString();
      }

      function setWasmTableEntry(idx, func) {
        wasmTable.set(idx, func);
        wasmTableMirror[idx] = wasmTable.get(idx);
      }

      function ___assert_fail(condition, filename, line, func) {abort('Assertion failed: ' + UTF8ToString(condition) + ', at: ' + [filename ? UTF8ToString(filename) : 'unknown filename', line, func ? UTF8ToString(func) : 'unknown function']);}

      function __embind_register_bigint(primitiveType, name, size, minRange, maxRange) {}

      function getShiftFromSize(size) {
        switch (size) {
          case 1:
            return 0;
          case 2:
            return 1;
          case 4:
            return 2;
          case 8:
            return 3;
          default:
            throw new TypeError('Unknown type size: ' + size);
        }
      }

      function embind_init_charCodes() {
        var codes = new Array(256);
        for (var i = 0; i < 256; ++i) {codes[i] = String.fromCharCode(i);}
        embind_charCodes = codes;
      }

      var embind_charCodes = undefined;

      function readLatin1String(ptr) {
        var ret = '';
        var c = ptr;
        while (HEAPU8[c]) {ret += embind_charCodes[HEAPU8[c++]];}
        return ret;
      }

      var awaitingDependencies = {};
      var registeredTypes = {};
      var typeDependencies = {};
      var char_0 = 48;
      var char_9 = 57;

      function makeLegalFunctionName(name) {
        if (undefined === name) {return '_unknown';}
        name = name.replace(/[^a-zA-Z0-9_]/g, '$');
        var f = name.charCodeAt(0);
        if (f >= char_0 && f <= char_9) {return '_' + name;}
        return name;
      }

      function createNamedFunction(name, body) {
        name = makeLegalFunctionName(name);
        return new Function('body', 'return function ' + name + '() {\n' + '    "use strict";' + '    return body.apply(this, arguments);\n' + '};\n')(body);
      }

      function extendError(baseErrorType, errorName) {
        var errorClass = createNamedFunction(errorName, function (message) {
          this.name = errorName;
          this.message = message;
          var stack = new Error(message).stack;
          if (stack !== undefined) {this.stack = this.toString() + '\n' + stack.replace(/^Error(:[^\n]*)?\n/, '');}
        });
        errorClass.prototype = Object.create(baseErrorType.prototype);
        errorClass.prototype.constructor = errorClass;
        errorClass.prototype.toString = function () {if (this.message === undefined) {return this.name;} else {return this.name + ': ' + this.message;}};
        return errorClass;
      }

      var BindingError = undefined;

      function throwBindingError(message) {throw new BindingError(message);}

      var InternalError = undefined;

      function throwInternalError(message) {throw new InternalError(message);}

      function registerType(rawType, registeredInstance, options = {}) {
        if (!('argPackAdvance' in registeredInstance)) {throw new TypeError('registerType registeredInstance requires argPackAdvance');}
        var name = registeredInstance.name;
        if (!rawType) {throwBindingError('type "' + name + '" must have a positive integer typeid pointer');}
        if (registeredTypes.hasOwnProperty(rawType)) {if (options.ignoreDuplicateRegistrations) {return;} else {throwBindingError('Cannot register type \'' + name + '\' twice');}}
        registeredTypes[rawType] = registeredInstance;
        delete typeDependencies[rawType];
        if (awaitingDependencies.hasOwnProperty(rawType)) {
          var callbacks = awaitingDependencies[rawType];
          delete awaitingDependencies[rawType];
          callbacks.forEach(cb => cb());
        }
      }

      function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
        var shift = getShiftFromSize(size);
        name = readLatin1String(name);
        registerType(rawType, {
          name: name, 'fromWireType': function (wt) {return !!wt;}, 'toWireType': function (destructors, o) {return o ? trueValue : falseValue;}, 'argPackAdvance': 8, 'readValueFromPointer': function (pointer) {
            var heap;
            if (size === 1) {heap = HEAP8;} else if (size === 2) {heap = HEAP16;} else if (size === 4) {heap = HEAP32;} else {throw new TypeError('Unknown boolean type size: ' + name);}
            return this['fromWireType'](heap[pointer >> shift]);
          }, destructorFunction: null
        });
      }

      var emval_free_list = [];
      var emval_handle_array = [{}, { value: undefined }, { value: null }, { value: true }, { value: false }];

      function __emval_decref(handle) {
        if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
          emval_handle_array[handle] = undefined;
          emval_free_list.push(handle);
        }
      }

      function count_emval_handles() {
        var count = 0;
        for (var i = 5; i < emval_handle_array.length; ++i) {if (emval_handle_array[i] !== undefined) {++count;}}
        return count;
      }

      function get_first_emval() {
        for (var i = 5; i < emval_handle_array.length; ++i) {if (emval_handle_array[i] !== undefined) {return emval_handle_array[i];}}
        return null;
      }

      function init_emval() {
        Module['count_emval_handles'] = count_emval_handles;
        Module['get_first_emval'] = get_first_emval;
      }

      var Emval = {
        toValue: handle => {
          if (!handle) {throwBindingError('Cannot use deleted val. handle = ' + handle);}
          return emval_handle_array[handle].value;
        }, toHandle: value => {
          switch (value) {
            case undefined:
              return 1;
            case null:
              return 2;
            case true:
              return 3;
            case false:
              return 4;
            default: {
              var handle = emval_free_list.length ? emval_free_list.pop() : emval_handle_array.length;
              emval_handle_array[handle] = { refcount: 1, value: value };
              return handle;
            }
          }
        }
      };

      function simpleReadValueFromPointer(pointer) {return this['fromWireType'](HEAP32[pointer >> 2]);}

      function __embind_register_emval(rawType, name) {
        name = readLatin1String(name);
        registerType(rawType, {
          name: name, 'fromWireType': function (handle) {
            var rv = Emval.toValue(handle);
            __emval_decref(handle);
            return rv;
          }, 'toWireType': function (destructors, value) {return Emval.toHandle(value);}, 'argPackAdvance': 8, 'readValueFromPointer': simpleReadValueFromPointer, destructorFunction: null
        });
      }

      function floatReadValueFromPointer(name, shift) {
        switch (shift) {
          case 2:
            return function (pointer) {return this['fromWireType'](HEAPF32[pointer >> 2]);};
          case 3:
            return function (pointer) {return this['fromWireType'](HEAPF64[pointer >> 3]);};
          default:
            throw new TypeError('Unknown float type: ' + name);
        }
      }

      function __embind_register_float(rawType, name, size) {
        var shift = getShiftFromSize(size);
        name = readLatin1String(name);
        registerType(rawType, { name: name, 'fromWireType': function (value) {return value;}, 'toWireType': function (destructors, value) {return value;}, 'argPackAdvance': 8, 'readValueFromPointer': floatReadValueFromPointer(name, shift), destructorFunction: null });
      }

      function integerReadValueFromPointer(name, shift, signed) {
        switch (shift) {
          case 0:
            return signed ? function readS8FromPointer(pointer) {return HEAP8[pointer];} : function readU8FromPointer(pointer) {return HEAPU8[pointer];};
          case 1:
            return signed ? function readS16FromPointer(pointer) {return HEAP16[pointer >> 1];} : function readU16FromPointer(pointer) {return HEAPU16[pointer >> 1];};
          case 2:
            return signed ? function readS32FromPointer(pointer) {return HEAP32[pointer >> 2];} : function readU32FromPointer(pointer) {return HEAPU32[pointer >> 2];};
          default:
            throw new TypeError('Unknown integer type: ' + name);
        }
      }

      function __embind_register_integer(primitiveType, name, size, minRange, maxRange) {
        name = readLatin1String(name);
        if (maxRange === -1) {maxRange = 4294967295;}
        var shift = getShiftFromSize(size);
        var fromWireType = value => value;
        if (minRange === 0) {
          var bitshift = 32 - 8 * size;
          fromWireType = value => value << bitshift >>> bitshift;
        }
        var isUnsignedType = name.includes('unsigned');
        var checkAssertions = (value, toTypeName) => {};
        var toWireType;
        if (isUnsignedType) {
          toWireType = function (destructors, value) {
            checkAssertions(value, this.name);
            return value >>> 0;
          };
        } else {
          toWireType = function (destructors, value) {
            checkAssertions(value, this.name);
            return value;
          };
        }
        registerType(primitiveType, { name: name, 'fromWireType': fromWireType, 'toWireType': toWireType, 'argPackAdvance': 8, 'readValueFromPointer': integerReadValueFromPointer(name, shift, minRange !== 0), destructorFunction: null });
      }

      function __embind_register_memory_view(rawType, dataTypeIndex, name) {
        var typeMapping = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array];
        var TA = typeMapping[dataTypeIndex];

        function decodeMemoryView(handle) {
          handle = handle >> 2;
          var heap = HEAPU32;
          var size = heap[handle];
          var data = heap[handle + 1];
          return new TA(buffer, data, size);
        }

        name = readLatin1String(name);
        registerType(rawType, { name: name, 'fromWireType': decodeMemoryView, 'argPackAdvance': 8, 'readValueFromPointer': decodeMemoryView }, { ignoreDuplicateRegistrations: true });
      }

      function __embind_register_std_string(rawType, name) {
        name = readLatin1String(name);
        var stdStringIsUTF8 = name === 'std::string';
        registerType(rawType, {
          name: name, 'fromWireType': function (value) {
            var length = HEAPU32[value >> 2];
            var payload = value + 4;
            var str;
            if (stdStringIsUTF8) {
              var decodeStartPtr = payload;
              for (var i = 0; i <= length; ++i) {
                var currentBytePtr = payload + i;
                if (i == length || HEAPU8[currentBytePtr] == 0) {
                  var maxRead = currentBytePtr - decodeStartPtr;
                  var stringSegment = UTF8ToString(decodeStartPtr, maxRead);
                  if (str === undefined) {str = stringSegment;} else {
                    str += String.fromCharCode(0);
                    str += stringSegment;
                  }
                  decodeStartPtr = currentBytePtr + 1;
                }
              }
            } else {
              var a = new Array(length);
              for (var i = 0; i < length; ++i) {a[i] = String.fromCharCode(HEAPU8[payload + i]);}
              str = a.join('');
            }
            _free(value);
            return str;
          }, 'toWireType': function (destructors, value) {
            if (value instanceof ArrayBuffer) {value = new Uint8Array(value);}
            var length;
            var valueIsOfTypeString = typeof value == 'string';
            if (!(valueIsOfTypeString || value instanceof Uint8Array || value instanceof Uint8ClampedArray || value instanceof Int8Array)) {throwBindingError('Cannot pass non-string to std::string');}
            if (stdStringIsUTF8 && valueIsOfTypeString) {length = lengthBytesUTF8(value);} else {length = value.length;}
            var base = _malloc(4 + length + 1);
            var ptr = base + 4;
            HEAPU32[base >> 2] = length;
            if (stdStringIsUTF8 && valueIsOfTypeString) {stringToUTF8(value, ptr, length + 1);} else {
              if (valueIsOfTypeString) {
                for (var i = 0; i < length; ++i) {
                  var charCode = value.charCodeAt(i);
                  if (charCode > 255) {
                    _free(ptr);
                    throwBindingError('String has UTF-16 code units that do not fit in 8 bits');
                  }
                  HEAPU8[ptr + i] = charCode;
                }
              } else {for (var i = 0; i < length; ++i) {HEAPU8[ptr + i] = value[i];}}
            }
            if (destructors !== null) {destructors.push(_free, base);}
            return base;
          }, 'argPackAdvance': 8, 'readValueFromPointer': simpleReadValueFromPointer, destructorFunction: function (ptr) {_free(ptr);}
        });
      }

      function __embind_register_std_wstring(rawType, charSize, name) {
        name = readLatin1String(name);
        var decodeString, encodeString, getHeap, lengthBytesUTF, shift;
        if (charSize === 2) {
          decodeString = UTF16ToString;
          encodeString = stringToUTF16;
          lengthBytesUTF = lengthBytesUTF16;
          getHeap = () => HEAPU16;
          shift = 1;
        } else if (charSize === 4) {
          decodeString = UTF32ToString;
          encodeString = stringToUTF32;
          lengthBytesUTF = lengthBytesUTF32;
          getHeap = () => HEAPU32;
          shift = 2;
        }
        registerType(rawType, {
          name: name, 'fromWireType': function (value) {
            var length = HEAPU32[value >> 2];
            var HEAP = getHeap();
            var str;
            var decodeStartPtr = value + 4;
            for (var i = 0; i <= length; ++i) {
              var currentBytePtr = value + 4 + i * charSize;
              if (i == length || HEAP[currentBytePtr >> shift] == 0) {
                var maxReadBytes = currentBytePtr - decodeStartPtr;
                var stringSegment = decodeString(decodeStartPtr, maxReadBytes);
                if (str === undefined) {str = stringSegment;} else {
                  str += String.fromCharCode(0);
                  str += stringSegment;
                }
                decodeStartPtr = currentBytePtr + charSize;
              }
            }
            _free(value);
            return str;
          }, 'toWireType': function (destructors, value) {
            if (!(typeof value == 'string')) {throwBindingError('Cannot pass non-string to C++ string type ' + name);}
            var length = lengthBytesUTF(value);
            var ptr = _malloc(4 + length + charSize);
            HEAPU32[ptr >> 2] = length >> shift;
            encodeString(value, ptr + 4, length + charSize);
            if (destructors !== null) {destructors.push(_free, ptr);}
            return ptr;
          }, 'argPackAdvance': 8, 'readValueFromPointer': simpleReadValueFromPointer, destructorFunction: function (ptr) {_free(ptr);}
        });
      }

      function __embind_register_void(rawType, name) {
        name = readLatin1String(name);
        registerType(rawType, { isVoid: true, name: name, 'argPackAdvance': 0, 'fromWireType': function () {return undefined;}, 'toWireType': function (destructors, o) {return undefined;} });
      }

      var _wasm_workers = {};
      var _wasm_workers_id = 1;

      function __wasm_worker_appendToQueue(e) {__wasm_worker_delayedMessageQueue.push(e);}

      function __wasm_worker_runPostMessage(e) {
        let data = e.data, wasmCall = data['_wsc'];
        wasmCall && getWasmTableEntry(wasmCall)(...data['x']);
      }

      function __emscripten_create_wasm_worker(stackLowestAddress, stackSize) {
        let worker = _wasm_workers[_wasm_workers_id] = new SharedMemoryWorker();
        worker.postMessage({ '$ww': _wasm_workers_id, 'wasm': wasmModule, 'js': Module['mainScriptUrlOrBlob'] || _scriptDir, 'wasmMemory': wasmMemory, 'sb': stackLowestAddress, 'sz': stackSize });
        Module.$$wasmMemory = wasmMemory;
        Module.$$worker = worker;
        worker.addEventListener('message', __wasm_worker_runPostMessage);
        return _wasm_workers_id++;
      }

      var __wasm_worker_delayedMessageQueue = [];

      function __wasm_worker_initializeRuntime() {
        let m = Module;
        _emscripten_wasm_worker_initialize(m['sb'], m['sz']);
        removeEventListener('message', __wasm_worker_appendToQueue);
        __wasm_worker_delayedMessageQueue = __wasm_worker_delayedMessageQueue.forEach(__wasm_worker_runPostMessage);
        addEventListener('message', __wasm_worker_runPostMessage);
      }

      var readAsmConstArgsArray = [];

      function readAsmConstArgs(sigPtr, buf) {
        readAsmConstArgsArray.length = 0;
        var ch;
        buf >>= 2;
        while (ch = HEAPU8[sigPtr++]) {
          buf += ch != 105 & buf;
          readAsmConstArgsArray.push(ch == 105 ? HEAP32[buf] : HEAPF64[buf++ >> 1]);
          ++buf;
        }
        return readAsmConstArgsArray;
      }

      function _emscripten_asm_const_int(code, sigPtr, argbuf) {
        var args = readAsmConstArgs(sigPtr, argbuf);
        return ASM_CONSTS[code].apply(null, args);
      }

      function _emscripten_console_log(str) {console.log(UTF8ToString(str));}

      function _emscripten_memcpy_big(dest, src, num) {HEAPU8.copyWithin(dest, src, src + num);}

      function abortOnCannotGrowMemory(requestedSize) {abort('OOM');}

      function _emscripten_resize_heap(requestedSize) {
        var oldSize = HEAPU8.length;
        requestedSize = requestedSize >>> 0;
        abortOnCannotGrowMemory(requestedSize);
      }

      function _emscripten_wasm_worker_post_function_v(id, funcPtr) {_wasm_workers[id].postMessage({ '_wsc': funcPtr, 'x': [] });}

      var printCharBuffers = [null, [], []];

      function printChar(stream, curr) {
        var buffer = printCharBuffers[stream];
        if (curr === 0 || curr === 10) {
          (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
          buffer.length = 0;
        } else {buffer.push(curr);}
      }

      var SYSCALLS = {
        varargs: undefined, get: function () {
          SYSCALLS.varargs += 4;
          var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
          return ret;
        }, getStr: function (ptr) {
          var ret = UTF8ToString(ptr);
          return ret;
        }
      };

      function _fd_write(fd, iov, iovcnt, pnum) {
        var num = 0;
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAPU32[iov >> 2];
          var len = HEAPU32[iov + 4 >> 2];
          iov += 8;
          for (var j = 0; j < len; j++) {printChar(fd, HEAPU8[ptr + j]);}
          num += len;
        }
        HEAPU32[pnum >> 2] = num;
        return 0;
      }

      function _setTempRet0(val) {setTempRet0(val);}

      embind_init_charCodes();
      BindingError = Module['BindingError'] = extendError(Error, 'BindingError');
      InternalError = Module['InternalError'] = extendError(Error, 'InternalError');
      init_emval();
      if (ENVIRONMENT_IS_WASM_WORKER) {
        _wasm_workers[0] = this;
        addEventListener('message', __wasm_worker_appendToQueue);
      }
      var ASSERTIONS = false;
      var asmLibraryArg = { '__assert_fail': ___assert_fail, '_embind_register_bigint': __embind_register_bigint, '_embind_register_bool': __embind_register_bool, '_embind_register_emval': __embind_register_emval, '_embind_register_float': __embind_register_float, '_embind_register_integer': __embind_register_integer, '_embind_register_memory_view': __embind_register_memory_view, '_embind_register_std_string': __embind_register_std_string, '_embind_register_std_wstring': __embind_register_std_wstring, '_embind_register_void': __embind_register_void, '_emscripten_create_wasm_worker': __emscripten_create_wasm_worker, 'emscripten_asm_const_int': _emscripten_asm_const_int, 'emscripten_console_log': _emscripten_console_log, 'emscripten_memcpy_big': _emscripten_memcpy_big, 'emscripten_resize_heap': _emscripten_resize_heap, 'emscripten_wasm_worker_post_function_v': _emscripten_wasm_worker_post_function_v, 'fd_write': _fd_write, 'memory': wasmMemory, 'setTempRet0': _setTempRet0 };
      var asm = createWasm();
      var ___wasm_call_ctors = Module['___wasm_call_ctors'] = function () {return (___wasm_call_ctors = Module['___wasm_call_ctors'] = Module['asm']['__wasm_call_ctors']).apply(null, arguments);};
      var _main = Module['_main'] = function () {return (_main = Module['_main'] = Module['asm']['main']).apply(null, arguments);};
      var ___getTypeName = Module['___getTypeName'] = function () {return (___getTypeName = Module['___getTypeName'] = Module['asm']['__getTypeName']).apply(null, arguments);};
      var ___embind_register_native_and_builtin_types = Module['___embind_register_native_and_builtin_types'] = function () {return (___embind_register_native_and_builtin_types = Module['___embind_register_native_and_builtin_types'] = Module['asm']['__embind_register_native_and_builtin_types']).apply(null, arguments);};
      var ___errno_location = Module['___errno_location'] = function () {return (___errno_location = Module['___errno_location'] = Module['asm']['__errno_location']).apply(null, arguments);};
      var _malloc = Module['_malloc'] = function () {return (_malloc = Module['_malloc'] = Module['asm']['malloc']).apply(null, arguments);};
      var _free = Module['_free'] = function () {return (_free = Module['_free'] = Module['asm']['free']).apply(null, arguments);};
      var _setThrew = Module['_setThrew'] = function () {return (_setThrew = Module['_setThrew'] = Module['asm']['setThrew']).apply(null, arguments);};
      var _emscripten_wasm_worker_initialize = Module['_emscripten_wasm_worker_initialize'] = function () {return (_emscripten_wasm_worker_initialize = Module['_emscripten_wasm_worker_initialize'] = Module['asm']['emscripten_wasm_worker_initialize']).apply(null, arguments);};
      var stackSave = Module['stackSave'] = function () {return (stackSave = Module['stackSave'] = Module['asm']['stackSave']).apply(null, arguments);};
      var stackRestore = Module['stackRestore'] = function () {return (stackRestore = Module['stackRestore'] = Module['asm']['stackRestore']).apply(null, arguments);};
      var stackAlloc = Module['stackAlloc'] = function () {return (stackAlloc = Module['stackAlloc'] = Module['asm']['stackAlloc']).apply(null, arguments);};
      var ___cxa_can_catch = Module['___cxa_can_catch'] = function () {return (___cxa_can_catch = Module['___cxa_can_catch'] = Module['asm']['__cxa_can_catch']).apply(null, arguments);};
      var ___cxa_is_pointer_type = Module['___cxa_is_pointer_type'] = function () {return (___cxa_is_pointer_type = Module['___cxa_is_pointer_type'] = Module['asm']['__cxa_is_pointer_type']).apply(null, arguments);};
      var dynCall_jiji = Module['dynCall_jiji'] = function () {return (dynCall_jiji = Module['dynCall_jiji'] = Module['asm']['dynCall_jiji']).apply(null, arguments);};
      var calledRun;

      function ExitStatus(status) {
        this.name = 'ExitStatus';
        this.message = 'Program terminated with exit(' + status + ')';
        this.status = status;
      }

      var calledMain = false;
      dependenciesFulfilled = function runCaller() {
        if (!calledRun) run();
        if (!calledRun) dependenciesFulfilled = runCaller;
      };

      function callMain(args) {
        var entryFunction = Module['_main'];
        var argc = 0;
        var argv = 0;
        try {
          var ret = entryFunction(argc, argv);
          exit(ret, true);
          return ret;
        } catch (e) {return handleException(e);} finally {calledMain = true;}
      }

      function run(args) {
        args = args || arguments_;
        if (runDependencies > 0) {return;}
        if (ENVIRONMENT_IS_WASM_WORKER) {
          readyPromiseResolve(Module);
          return initRuntime();
        }
        preRun();
        if (runDependencies > 0) {return;}

        function doRun() {
          if (calledRun) return;
          calledRun = true;
          Module['calledRun'] = true;
          if (ABORT) return;
          initRuntime();
          preMain();
          readyPromiseResolve(Module);
          if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();
          if (shouldRunNow) callMain(args);
          postRun();
        }

        if (Module['setStatus']) {
          Module['setStatus']('Running...');
          setTimeout(function () {
            setTimeout(function () {Module['setStatus']('');}, 1);
            doRun();
          }, 1);
        } else {doRun();}
      }

      Module['run'] = run;

      function exit(status, implicit) {
        EXITSTATUS = status;
        procExit(status);
      }

      function procExit(code) {
        EXITSTATUS = code;
        if (!keepRuntimeAlive()) {
          if (Module['onExit']) Module['onExit'](code);
          ABORT = true;
        }
        quit_(code, new ExitStatus(code));
      }

      if (Module['preInit']) {
        if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
        while (Module['preInit'].length > 0) {Module['preInit'].pop()();}
      }
      var shouldRunNow = true;
      if (Module['noInitialRun']) shouldRunNow = false;
      run();


      return Module.ready;
    }
  );
})();

export default Module;
