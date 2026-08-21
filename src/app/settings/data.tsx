import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

import { DataSettingsScreen } from '@/features/settings/DataSettingsScreen';
import { useNotificationsStore } from '@/store/useNotificationsStore';
import { useSettingsStore } from '@/store/useSettingsStore';

export default function DataSettingsRoute() {
  return (
    <DataSettingsScreen
      onPressBack={() => router.back()}
      onClearCache={async () => {
        await AsyncStorage.multiRemove(['oyno.notifications.readIds', 'oyno.settings']);
        await Promise.all([useNotificationsStore.getState().load(), useSettingsStore.getState().load()]);
      }}
    />
  );
}
