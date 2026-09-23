import { WifiOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { colors } from '@/theme';

/** "This content isn't available offline yet." - shown instead of an
 * endless spinner when a screen's data was never downloaded. Retry is
 * offered once the connection is back. */
export function OfflineUnavailable({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isOffline } = useNetworkStatus();

  return (
    <View style={[styles.center, { paddingTop: insets.top }]}>
      <EmptyState
        icon={WifiOff}
        title={t('offline.notAvailable')}
        description={isOffline ? t('offline.notAvailableHint') : undefined}
        actionLabel={isOffline ? undefined : t('offline.retry')}
        onPressAction={isOffline ? undefined : onRetry}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
