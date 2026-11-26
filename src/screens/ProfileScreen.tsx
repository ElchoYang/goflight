import { View, Button, Text, StyleSheet, Pressable } from 'react-native';
import {
  scheduleFlightNotification,
  PushNotification,
} from '../services/notificationService';
import { SafeAreaView } from 'react-native-safe-area-context';
import NotificationButton from '../components/NotificationButton';

export default function ProfileScreen() {
  const sendScheduleNotification = async () => {
    // 例如在点击预订成功后触发：
    await scheduleFlightNotification(
      '✈️ Flight Booking Confirmed!',
      'Your flight from Shenzhen to Tokyo is confirmed.',
      { screen: 'MyTripsTab' }, // 点击后会自动跳转到 MyTripsScreen
    );
  };

  const sendPushNotificationHandler = async () => {
    PushNotification();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.buttonSection}>
        <NotificationButton onPress={sendScheduleNotification}>
          Send Schedule Notification
        </NotificationButton>

        <NotificationButton onPress={sendPushNotificationHandler}>
          Send Push Notification
        </NotificationButton>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  buttonSection: { marginTop: 8, width: '50%', alignSelf: 'center' },
});
