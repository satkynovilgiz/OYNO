import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { NotFoundState } from '@/components/system/NotFoundState';
import { useAdminRole } from '@/services/admin/adminService';
import { colors } from '@/theme';

/**
 * Admin sub-screens are reachable by deep link (oyno://admin/push), not
 * only from the gated Settings row. The server already rejects every
 * admin action without a role; this keeps non-admins from even seeing the
 * tools - they get the normal not-found screen instead.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const { data: role, isLoading } = useAdminRole();
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!role) return <NotFoundState onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />;
  return children;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
