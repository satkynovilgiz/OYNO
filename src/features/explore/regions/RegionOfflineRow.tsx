import { CloudDownload, CloudOff, Check, RotateCw, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, ConfirmationModal } from '@/components/ui';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { CancelPackButton, packQueueDetail, usePackPending, useQueueGate } from '@/components/offline/QueueControls';
import { buildRegionOfflineManifest, downloadRegionPack, regionPackState, regionRequester, removeRegionPack } from '@/services/offline/regionPacks';
import { useOfflineStore } from '@/services/offline/useOfflineStore';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

import type { RegionExperienceConfig } from './regionExperiences';

/**
 * Region pack controls on the Region Hub: one compact row. Progress is
 * item-level ("3 / 5 items") because that is what the download system
 * really knows; no size is shown before downloading (not known in advance).
 */
export function RegionOfflineRow({ config, regionName }: { config: RegionExperienceConfig; regionName: string }) {
  const { t } = useTranslation();
  const { isOffline } = useNetworkStatus();
  const pack = useMemo(() => buildRegionOfflineManifest(config), [config]);
  const manifest = useOfflineStore((state) => state.manifest);
  const inFlight = useOfflineStore((state) => state.inFlight);
  const failed = useOfflineStore((state) => state.failed);
  const state = regionPackState(pack, config.id, manifest, inFlight, failed);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const gate = useQueueGate();
  const pending = usePackPending(regionRequester(config.id), pack.items);

  if (pack.items.length === 0) return null;
  const count = t('regionHub.offline.items', { downloaded: state.downloaded, total: state.total });
  const start = () => void downloadRegionPack(config.id, pack, useOfflineStore.getState);

  const title =
    state.status === 'available'
      ? t('regionHub.offline.available')
      : state.status === 'downloading'
        ? t('regionHub.offline.downloading')
        : state.status === 'partial'
          ? t('regionHub.offline.partial')
          : state.status === 'attention'
            ? t('regionHub.offline.attention')
            : t('regionHub.offline.download');
  const detail = state.status === 'none' ? t('regionHub.offline.includes', { count: state.total }) : state.status === 'downloading' ? packQueueDetail(t, gate, state.downloaded, state.total) : count;

  return (
    <View style={styles.row} accessible={false}>
      <View style={styles.icon}>
        {state.status === 'downloading' ? <ActivityIndicator size="small" color={colors.primary} /> : state.status === 'available' ? <Check size={18} color={colors.primary} strokeWidth={2.5} /> : isOffline ? <CloudOff size={18} color={colors.textMuted} strokeWidth={2} /> : <CloudDownload size={18} color={colors.primary} strokeWidth={2.25} />}
      </View>
      <View style={styles.text} accessible accessibilityLabel={`${title}. ${detail}`} accessibilityLiveRegion="polite">
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.detail}>{isOffline && state.status !== 'available' && state.status !== 'downloading' ? t('regionHub.offline.needsInternet') : detail}</Text>
      </View>
      {pending ? <CancelPackButton requester={regionRequester(config.id)} items={pack.items} name={regionName} /> : null}
      {state.status === 'none' ? (
        <AnimatedPressable style={styles.action} onPress={start} disabled={isOffline} accessibilityRole="button" accessibilityState={{ disabled: isOffline }} accessibilityLabel={t('regionHub.offline.downloadRegion', { name: regionName })}>
          <Text style={[styles.actionText, isOffline && styles.disabled]}>{t('regionHub.offline.downloadShort')}</Text>
        </AnimatedPressable>
      ) : null}
      {state.status === 'partial' || state.status === 'attention' ? (
        <AnimatedPressable style={styles.iconAction} onPress={start} disabled={isOffline} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('regionHub.offline.retry')}>
          <RotateCw size={18} color={isOffline ? colors.textMuted : colors.primary} strokeWidth={2.25} />
        </AnimatedPressable>
      ) : null}
      {state.requested && state.status !== 'downloading' ? (
        <AnimatedPressable style={styles.iconAction} onPress={() => setConfirmRemove(true)} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('regionHub.offline.remove')}>
          <Trash2 size={18} color={colors.textSecondary} strokeWidth={2} />
        </AnimatedPressable>
      ) : null}
      <ConfirmationModal
        visible={confirmRemove}
        title={t('regionHub.offline.removeTitle', { name: regionName })}
        message={t('regionHub.offline.removeMessage')}
        confirmLabel={t('regionHub.offline.remove')}
        cancelLabel={t('common.cancel')}
        destructive
        isConfirming={removing}
        onConfirm={async () => {
          setRemoving(true);
          await removeRegionPack(config.id, pack, useOfflineStore.getState);
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
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  text: { flex: 1, gap: 2 },
  title: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  detail: { ...textStyles.caption, color: colors.textSecondary },
  action: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm },
  actionText: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.primary },
  disabled: { color: colors.textMuted },
  iconAction: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
