import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from '../services/notificationService';
import { navigate } from '../navigation/navigationRef';

export function useNotifications() {
  const notificationListener = useRef<Notifications.EventSubscription | null>(
    null,
  );
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // 1. 初始化权限
    registerForPushNotificationsAsync();

    // 2. 监听前台收到的通知
    notificationListener.current =
      Notifications.addNotificationReceivedListener(notification => {
        console.log('Foreground notification received:', notification);
      });

    // 3. 监听用户点击了通知栏消息
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(response => {
        console.log('User clicked notification:', response);
        const data = response.notification.request.content.data;

        // 根据通知带的数据跳转到对应页面
        if (data?.screen) {
          navigate(data.screen as string, data.params);
        }
      });

    return () => {
      // 卸载监听
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);
}
