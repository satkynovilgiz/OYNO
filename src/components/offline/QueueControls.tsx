import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import type { RegionPackItem } from '@/services/offline/regionPacks';
import { cancelPackItems } from '@/services/offline/regionPacks';
import { useOfflineStore } from '@/services/offline/useOfflineStore';
import { colors } from '@/theme';

/** Current network gate of the download queue ('go' | 'waiting_wifi' | 'waiting_connection'). */
export function useQueueGate() {
  return useOfflineStore((state) => state.gate());
}

/** True while this owner still has queued / running items in the pack. */
export function usePackPending(requester: string, items: readonly RegionPackItem[]) {
  return useOfflineStore((state) => state.queue.intents.some((intent) => intent.status !== 'failed' && intent.requesters.includes(requester) && items.some((item) => item.id === intent.id)));
}

/** Pack status line while queued: "Waiting for Wi-Fi · 3 of 7 items" (real counts, never a percentage). */
export function packQueueDetail(t: (key: string, options?: Record<string, unknown>) => string, gate: string, done: number, total: number) {
  const status = gate === 'go' ? t('downloads.status.downloading') : t(`downloads.status.${gate}`);
  return `${status} · ${t('downloads.progress', { done, total })}`;
}

/** Cancel this pack's pending request (shared items other owners need continue). */
export function CancelPackButton({ requester, items, name }: { requester: string; items: readonly RegionPackItem[]; name: string }) {
  const { t } = useTranslation();
  return (
    <AnimatedPressable style={styles.icon} onPress={() => void cancelPackItems(requester, items, useOfflineStore.getState)} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('downloads.cancelPack', { name })}>
      <X size={18} color={colors.textSecondary} strokeWidth={2.25} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
