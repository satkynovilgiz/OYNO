import { Check, CloudDownload, CloudOff, RotateCw, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, ConfirmationModal } from '@/components/ui';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { CancelPackButton, packQueueDetail, usePackPending, useQueueGate } from '@/components/offline/QueueControls';
import { downloadPathPack, pathRequester, removePathPack, type LearningPathOfflineManifest, type PathPackState } from '@/services/offline/pathPacks';
import { useOfflineStore } from '@/services/offline/useOfflineStore';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

/**
 * "Download for offline" for a Learning Path - same row pattern as the
 * Region pack. Progress is step-level and honest ("4 of 5 available
 * offline"); before downloading only an item count is shown (the system
 * can't know byte sizes in advance, so no MB estimate).
 */
export function PathOfflineRow({ pack, state, title }: { pack: LearningPathOfflineManifest; state: PathPackState; title: string }) {
  const { t } = useTranslation();
  const { isOffline } = useNetworkStatus();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const start = () => void downloadPathPack(pack, useOfflineStore.getState);
  const gate = useQueueGate();
  const pending = usePackPending(pathRequester(pack.pathId), pack.items);

  const heading =
    state.status === 'available'
      ? t('pathOffline.available')
      : state.status === 'downloading'
        ? t('pathOffline.downloading')
        : state.status === 'partial'
          ? t('pathOffline.partial', { available: state.offlineCapable, total: state.totalSteps })
          : state.status === 'attention'
            ? t('pathOffline.retryTitle', { available: state.offlineCapable, total: state.totalSteps })
            : t('pathOffline.download');
  const detail =
    state.status === 'downloading'
      ? packQueueDetail(t, gate, pack.items.length - state.missingItems, pack.items.length)
      : isOffline && state.status !== 'available'
      ? t('pathOffline.needsInternet')
      : state.status === 'available'
        ? t('pathOffline.availableDetail')
        : t('pathOffline.toDownload', { count: state.missingItems });

  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        {state.status === 'downloading' ? <ActivityIndicator size="small" color={colors.primary} /> : state.status === 'available' ? <Check size={18} color={colors.primary} strokeWidth={2.5} /> : isOffline ? <CloudOff size={18} color={colors.textMuted} strokeWidth={2} /> : <CloudDownload size={18} color={colors.primary} strokeWidth={2.25} />}
      </View>
      <View style={styles.text} accessible accessibilityLabel={`${heading}. ${detail}`} accessibilityLiveRegion="polite">
        <Text style={styles.title}>{heading}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      {pending ? <CancelPackButton requester={pathRequester(pack.pathId)} items={pack.items} name={title} /> : null}
      {state.status === 'none' ? (
        <AnimatedPressable style={styles.action} onPress={start} disabled={isOffline} accessibilityRole="button" accessibilityState={{ disabled: isOffline }} aria-disabled={isOffline} accessibilityLabel={t('pathOffline.downloadPath', { title })}>
          <Text style={[styles.actionText, isOffline && styles.disabled]}>{t('pathOffline.downloadShort')}</Text>
        </AnimatedPressable>
      ) : null}
      {state.status === 'partial' || state.status === 'attention' ? (
        <AnimatedPressable style={styles.iconAction} onPress={start} disabled={isOffline} hitSlop={6} accessibilityRole="button" accessibilityState={{ disabled: isOffline }} aria-disabled={isOffline} accessibilityLabel={t('pathOffline.retry')}>
          <RotateCw size={18} color={isOffline ? colors.textMuted : colors.primary} strokeWidth={2.25} />
        </AnimatedPressable>
      ) : null}
      {state.requested && state.status !== 'downloading' ? (
        <AnimatedPressable style={styles.iconAction} onPress={() => setConfirmRemove(true)} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('pathOffline.remove')}>
          <Trash2 size={18} color={colors.textSecondary} strokeWidth={2} />
        </AnimatedPressable>
      ) : null}
      <ConfirmationModal
        visible={confirmRemove}
        title={t('pathOffline.removeTitle', { title })}
        message={t('pathOffline.removeMessage')}
        confirmLabel={t('pathOffline.remove')}
        cancelLabel={t('common.cancel')}
        destructive
        isConfirming={removing}
        onConfirm={async () => {
          setRemoving(true);
          await removePathPack(pack, useOfflineStore.getState);
          setRemoving(false);
          setConfirmRemove(false);
        }}
        onCancel={() => setConfirmRemove(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  icon: { width: 32, alignItems: 'center' },
  text: { flex: 1, gap: 2 },
  title: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  detail: { ...textStyles.small, color: colors.textSecondary },
  action: { minHeight: 36, paddingHorizontal: spacing.sm, justifyContent: 'center', borderRadius: 18, backgroundColor: colors.surfaceMuted },
  actionText: { ...textStyles.small, fontWeight: '700', color: colors.primary },
  disabled: { color: colors.textMuted },
  iconAction: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
