import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export const haptic = {
  tap: () => {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  success: () => {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  warning: () => {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
  medium: () => {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
};
