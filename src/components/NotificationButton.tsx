import {
  Pressable,
  Text,
  StyleSheet,
  PressableProps,
  StyleProp,
} from 'react-native';

export interface NotificationButtonProps extends Omit<PressableProps, 'style'> {
  children?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}

export default function NotificationButton({
  children,
  onPress,
  disabled,
}: NotificationButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) =>
        pressed
          ? [styles.notificationBtn, styles.pressedItem]
          : styles.notificationBtn
      }
    >
      <Text style={styles.notificatoinBtnText}>{children} </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  notificationBtn: {
    borderRadius: 12,
    padding: 8,
    backgroundColor: '#45a5e6',
    marginVertical: 8,
  },

  notificatoinBtnText: {
    color: '#fff',
    textAlign: 'center',
  },
  pressedItem: {
    opacity: 0.5,
  },
});
