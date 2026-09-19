import { useNetworkState } from 'expo-network';
import { WifiOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/theme';

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
  const { isConnected } = useNetworkState();

  if (isConnected !== false) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + spacing.xxs }]} pointerEvents="none">
      <WifiOff size={14} color={colors.textOnDark} strokeWidth={2.25} />
      <Text style={styles.text}>{t('common.offline')}</Text>
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
