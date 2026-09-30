import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AdminGate } from '@/features/admin/AdminGate';
import { AdminSectionScreen } from '@/features/admin/AdminSectionScreen';
import { getAdminSection } from '@/features/admin/sections';
import { colors } from '@/theme';

export default function AdminSectionRoute() {
  const { section: sectionId } = useLocalSearchParams<{ section: string }>();
  const section = getAdminSection(sectionId ?? '');

  // The gate runs first, so a non-admin never learns which sections exist.
  return (
    <AdminGate>
      {section ? (
        <AdminSectionScreen section={section} onPressBack={() => router.back()} />
      ) : (
        <View style={styles.center}>
          <Text style={styles.message}>Unknown admin section.</Text>
        </View>
      )}
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  message: {
    color: colors.textSecondary,
  },
});
