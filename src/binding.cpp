#include <emscripten.h>
#include <stdio.h>


#include <emscripten.h>
#include <emscripten/console.h>
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
    printf("123\n");
    return reinterpret_cast<MyClass*>(address);
}


EMSCRIPTEN_BINDINGS(my_class_example) {
  class_<MyClass>("MyClass")
    .constructor<>()
    .property("data", &MyClass::data);

  function("getAddress", &getAddress);
  function("getDataFromAddress", &getDataFromAddress);
  function("getInstanceFromAddress", &getInstanceFromAddress, allow_raw_pointers());
}
