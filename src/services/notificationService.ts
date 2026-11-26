import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 1. 设置应用在前台时如何展示通知
Notifications.setNotificationHandler({
  handleNotification: async () => {
    return {
      shouldShowBanner: true, // 前台横幅
      shouldShowList: true, // 通知中心列表
      shouldPlaySound: true, // 播放声音
      shouldSetBadge: true, // 角标
    };
  },
});

// 2. 申请权限并获取 Expo Push Token
export async function registerForPushNotificationsAsync() {
  let token;

  // Android 通知渠道配置
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  // 检查权限
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Notification permission not granted!');
    return null;
  }

  // 如果需要远程推送 token（本地通知不需要获取 token 也能发）
  const res = await Notifications.getExpoPushTokenAsync({
    projectId: 'b74e5230-145c-465c-8cf2-9e05ee91e1e1',
  });

  token = res?.data;
  console.log('res:', res);
  console.log('token:', token);
  if (token) {
    await AsyncStorage.setItem('token', token);
  }

  return token;
}

// 3. 示例：发送/调度一个本地通知
export async function scheduleFlightNotification(
  title: string,
  body: string,
  data?: any,
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: null, // null 表示立即发送；或者设置 seconds: 5 延时发送
  });
}

export async function PushNotification() {
  const token = await AsyncStorage.getItem('token');
  console.log('stored token in PushNotification:', token);

  fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: token,
      title: 'Test - sent from a device!',
      body: 'This is a test!',
    }),
  });
}
