import { useNetworkState } from 'expo-network';
import { WifiOff } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/theme';

/**
 * Real, live connectivity detection (expo-network's useNetworkState, which
 * subscribes to native connectivity changes on device and navigator.onLine
 * on web) - shown globally so any screen the user is on reflects it. Honest
 * caveat: nothing in the app currently makes a network call (no backend is
 * wired up yet - see PROGRESS_AUDIT.md), so this doesn't unblock or retry
 * anything today. It exists so the infrastructure is real and ready for
 * when a backend does exist, per the master prompt's own phase ordering
 * (offline/error states before the games/backend phases).
 *
 * `isConnected === false` is the only state treated as "offline" - `true`
 * or `undefined` (not yet known, e.g. right after boot) render nothing, so
 * a slow first read never flashes a false "offline" banner.
 */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const { isConnected } = useNetworkState();

  if (isConnected !== false) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + spacing.xxs }]} pointerEvents="none">
      <WifiOff size={14} color={colors.textOnDark} strokeWidth={2.25} />
      <Text style={styles.text}>Интернет байланышы жок</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    backgroundColor: colors.danger,
    paddingBottom: spacing.xxs,
  },
  text: {
    ...typography.small,
    color: colors.textOnDark,
    fontWeight: '700',
  },
});
