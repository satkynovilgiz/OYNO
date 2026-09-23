import { WifiOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNetworkStatus } from '@/services/offline/networkStatus';
import { colors, radii, spacing, typography } from '@/theme';

/**
 * Real, live connectivity detection (expo-network's useNetworkState, which
 * subscribes to native connectivity changes on device and navigator.onLine
 * on web) - shown globally so any screen the user is on reflects it. Every
 * Culture/Explore/Games screen now genuinely does make network calls
 * (Supabase-backed content), so this is real, load-bearing feedback, not
 * placeholder infrastructure for a future backend.
 *
 * `isConnected === false` is the only state treated as "offline" - `true`
 * or `undefined` (not yet known, e.g. right after boot) render nothing, so
 * a slow first read never flashes a false "offline" banner.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isOffline } = useNetworkStatus();

  if (!isOffline) return null;

  // A small pill, not a red error bar: offline is a mode (downloaded
  // content keeps working), and it never blocks touches.
  return (
    <View style={[styles.wrap, { top: insets.top + spacing.xxs }]} pointerEvents="none" accessibilityLiveRegion="polite">
      <View style={styles.banner}>
        <WifiOff size={13} color={colors.accentGold} strokeWidth={2.25} />
        <Text style={styles.text}>{t('offline.banner')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceFeature,
  },
  text: {
    ...typography.small,
    color: colors.textOnDark,
    fontWeight: '700',
  },
});
