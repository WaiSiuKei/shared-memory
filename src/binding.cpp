#include <emscripten/bind.h>
using namespace emscripten;

class MyClass {
public:
    int data;
};

uintptr_t getAddress(MyClass& instance) {
    return reinterpret_cast<uintptr_t>(&instance);
}

int getDataFromAddress(uintptr_t address) {
    MyClass* instance = reinterpret_cast<MyClass*>(address);
    return instance->data; // 从地址读取data的值
}

MyClass* getInstanceFromAddress(uintptr_t address) {
    return reinterpret_cast<MyClass*>(address);
}

void allocate(uintptr_t address) {
    int i;
    int len = 10;
    char* p = reinterpret_cast<char *>(address);
    for(i = 0; i < len; i++) {
        p[i] = 'a' + (char)i;
    }
    p[len] = '\n';
}
char read(uintptr_t address) {
    char* buffer = reinterpret_cast<char *>(address);
    return buffer[0];
}

int getSize() {
    return sizeof(char);
}

void modify(uintptr_t address, int length) {
    uint8_t* data = reinterpret_cast<uint8_t *>(address);
    for (int i = 0; i < length; i++) {
        data[i] *= 2;  // 将每个元素乘以2
    }
}


EMSCRIPTEN_BINDINGS(my_class_example) {
  class_<MyClass>("MyClass")
    .constructor<>()
    .property("data", &MyClass::data);

  function("getAddress", &getAddress);
  function("getDataFromAddress", &getDataFromAddress);
  function("getInstanceFromAddress", &getInstanceFromAddress, allow_raw_pointers());
  function("allocate", &allocate, allow_raw_pointers());
  function("read", &read);
  function("getSize", &getSize);
  function("modify", &modify);
}
