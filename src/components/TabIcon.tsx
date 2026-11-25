import React, { ComponentProps } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';

// 提取 Ionicons 组件的 name 属性类型
type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface TabIconProps {
  name: IoniconName; // 传入非法图标名时 TS 会直接报错提示
  focused: boolean;
}

export function TabIcon({ name, focused }: TabIconProps) {
  return (
    <Ionicons name={name} size={24} color={focused ? '#007AFF' : '#8E8E93'} />
  );
}
