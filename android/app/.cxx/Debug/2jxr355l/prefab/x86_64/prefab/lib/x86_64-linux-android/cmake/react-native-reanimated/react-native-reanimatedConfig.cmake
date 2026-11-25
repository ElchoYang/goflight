if(NOT TARGET react-native-reanimated::reanimated)
add_library(react-native-reanimated::reanimated SHARED IMPORTED)
set_target_properties(react-native-reanimated::reanimated PROPERTIES
    IMPORTED_LOCATION "C:/rn/RN_Cli_Demo/node_modules/react-native-reanimated/android/build/intermediates/cxx/Debug/5y4h4ib3/obj/x86_64/libreanimated.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/rn/RN_Cli_Demo/node_modules/react-native-reanimated/android/build/prefab-headers/reanimated"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

