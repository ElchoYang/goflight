if(NOT TARGET hermes-engine::hermesvm)
add_library(hermes-engine::hermesvm SHARED IMPORTED)
set_target_properties(hermes-engine::hermesvm PROPERTIES
    IMPORTED_LOCATION "C:/Users/033431672/.gradle/caches/9.4.1/transforms/ee8d0074f98bc389399ad70b411be003/transformed/hermes-android-260318099.0.5-debug/prefab/modules/hermesvm/libs/android.x86_64/libhermesvm.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/033431672/.gradle/caches/9.4.1/transforms/ee8d0074f98bc389399ad70b411be003/transformed/hermes-android-260318099.0.5-debug/prefab/modules/hermesvm/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

