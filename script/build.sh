 emcc -lembind \
  src/binding.cpp \
  -O2 \
  -s WASM=1 \
  -s MODULARIZE \
  -s EXPORT_ES6=1 \
  -sENVIRONMENT=web,worker \
  -sNO_DISABLE_EXCEPTION_CATCHING \
  -o src/binding.js \
  --no-entry

#emcc --bind \
#  src/binding.cpp \
#-s "EXPORTED_RUNTIME_METHODS=['intArrayFromString', 'allocateUTF8', 'getValue', 'setValue']" -s WASM=1 -s MODULARIZE  -s ERROR_ON_UNDEFINED_SYMBOLS=0
