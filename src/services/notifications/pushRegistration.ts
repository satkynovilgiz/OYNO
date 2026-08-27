import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/services/supabase/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Registers this device for push and stores the token server-side
 * (register_push_token RPC, supabase/migrations/20260829000006_push_notifications.sql)
 * so admin_send_push_broadcast has someone to send to. Called once per
 * authenticated session from _layout.tsx, same pattern as the other
 * per-authStatus loaders there.
 *
 * Every failure mode here is expected, not exceptional, so this never
 * throws: Expo Go on Android can't do remote push at all from SDK 53+
 * (getExpoPushTokenAsync throws), a user can decline the permission
 * prompt, and there's no eas.projectId in a dev environment that never
 * configured one. All of these should just mean "no token this session",
 * not a crash or a logged error the user can't act on.
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    const finalStatus =
      existingStatus === 'granted' ? existingStatus : (await Notifications.requestPermissionsAsync()).status;
    if (finalStatus !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
  } catch (error) {
    if (__DEV__) console.warn('[push] registration skipped', error);
  }
}
