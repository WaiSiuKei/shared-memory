 emcc -lembind \
  src/worker.cpp \
  -O2 \
  -s WASM=1 \
  -s MODULARIZE \
  -sWASM_WORKERS\
  -sSHARED_MEMORY \
  -sENVIRONMENT=worker \
  -sNO_DISABLE_EXCEPTION_CATCHING \
  -s "EXPORTED_FUNCTIONS=['_main']" \
  -o src/worker-wasm.js \
  --no-entry
