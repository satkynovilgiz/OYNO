import { router } from 'expo-router';
import { HardDrive, RotateCw, Sparkles, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, Button, ConfirmationModal } from '@/components/ui';
import { showToast } from '@/components/ui/Toast';
import { listRegionExperiences } from '@/features/explore/regions/regionExperiences';
import { useRegionExperiences } from '@/features/explore/regions/useRegionExperiences';
import { LEARNING_PATHS } from '@/features/learn/learningPaths';
import type { SupportedLanguage } from '@/i18n';
import { useExploreRegions } from '@/services/content/exploreService';
import { mapExploreRegionName } from '@/services/content/types';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { formatBytes } from '@/services/offline/offlineModel';
import { buildLearningPathOfflineManifest, downloadPathPack, learningPathPackState, removePathPack, requestedPathIds } from '@/services/offline/pathPacks';
import { buildRegionOfflineManifest, downloadRegionPack, regionPackState, removeRegionPack, requestedRegionIds } from '@/services/offline/regionPacks';
import { keptAfterRemoval, needsAttention, staleOwners, storageInventory, unusedEntries } from '@/services/offline/storageModel';
import { useOfflineStore } from '@/services/offline/useOfflineStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { SettingsRow, SettingsSection } from './components/SettingsRow';
import { SettingsScreenLayout } from './components/SettingsScreenLayout';

type Pack = { key: string; type: 'path' | 'region'; name: string; status: 'none' | 'downloading' | 'available' | 'partial' | 'attention'; items: number; itemIds: string[]; remove: () => Promise<void>; retry: () => Promise<unknown> };

/**
 * /settings/storage - storage over the EXISTING offline manifest. Counts
 * are real item counts; the only size shown is the measured size of the
 * offline data OYNO stores itself. Works offline (local manifest only);
 * downloading/retrying needs a connection and says so.
 */
export function StorageScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const { isOffline } = useNetworkStatus();
  const manifest = useOfflineStore((state) => state.manifest);
  const inFlight = useOfflineStore((state) => state.inFlight);
  const failed = useOfflineStore((state) => state.failed);
  const regionConfigs = useRegionExperiences();
  const { data: regions } = useExploreRegions();
  const [bytes, setBytes] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'pack'; pack: Pack } | { kind: 'cleanup' } | { kind: 'clearAll' } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void useOfflineStore.getState().load();
  }, []);
  useEffect(() => {
    let cancelled = false;
    void useOfflineStore
      .getState()
      .measureBytes()
      .then((value) => !cancelled && setBytes(value))
      .catch(() => !cancelled && setBytes(null));
    return () => {
      cancelled = true;
    };
  }, [manifest]);

  const inventory = useMemo(() => storageInventory(manifest, inFlight), [manifest, inFlight]);
  // Owners are judged only against KNOWN lists (bundled regions, paths).
  const known = useMemo(() => ({ regionIds: listRegionExperiences().map((config) => config.id), pathIds: LEARNING_PATHS.map((path) => path.id) }), []);
  const unused = unusedEntries(manifest, known);
  const attention = needsAttention(manifest, inFlight, failed);
  const store = useOfflineStore.getState;

  const packs: Pack[] = [
    ...requestedPathIds(manifest).flatMap((pathId): Pack[] => {
      const path = LEARNING_PATHS.find((candidate) => candidate.id === pathId);
      if (!path) return [];
      const pack = buildLearningPathOfflineManifest(path);
      const state = learningPathPackState(pack, manifest, inFlight, failed);
      return [{ key: `path:${pathId}`, type: 'path', name: t(path.titleKey), status: state.status, items: pack.items.length, itemIds: pack.items.map((item) => item.id), remove: () => removePathPack(pack, store), retry: () => downloadPathPack(pack, store) }];
    }),
    ...requestedRegionIds(manifest).flatMap((regionId): Pack[] => {
      const config = regionConfigs.find((candidate) => candidate.id === regionId);
      if (!config) return [];
      const pack = buildRegionOfflineManifest(config);
      const state = regionPackState(pack, regionId, manifest, inFlight, failed);
      const row = regions?.find((candidate) => candidate.id === regionId);
      return [{ key: `region:${regionId}`, type: 'region', name: row ? (mapExploreRegionName(row)[i18n.language as SupportedLanguage] ?? row.name_kg) : regionId, status: state.status, items: pack.items.length, itemIds: pack.items.map((item) => item.id), remove: () => removeRegionPack(regionId, pack, store), retry: () => downloadRegionPack(regionId, pack, store) }];
    }),
  ];
  const statusLabel = (status: Pack['status']) => (status === 'available' ? t('storage.available') : status === 'downloading' ? t('storage.downloading') : status === 'attention' ? t('storage.needsAttention') : t('storage.partial'));
  const units = t('offline.v2.units', { returnObjects: true }) as { b: string; kb: string; mb: string };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === 'pack') {
        await confirm.pack.remove();
        const kept = keptAfterRemoval(useOfflineStore.getState().manifest, confirm.pack.itemIds);
        showToast(kept > 0 ? t('storage.keptShared') : t('storage.removed'));
      } else if (confirm.kind === 'cleanup') {
        for (const id of unused) {
          const entry = useOfflineStore.getState().manifest.entries[id];
          if (!entry) continue;
          for (const owner of staleOwners(entry, known)) await useOfflineStore.getState().release(id, owner);
        }
        showToast(t('storage.cleaned'));
      } else {
        // Offline copies only - progress, Journal, notes, favorites, collections and account data stay.
        await useOfflineStore.getState().removeAll();
        showToast(t('storage.clearedAll'));
      }
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <SettingsScreenLayout title={t('storage.title')} onPressBack={onPressBack}>
      <View style={styles.stack}>
        <View style={styles.summary} accessible accessibilityLabel={`${t('storage.downloadedContent')}. ${t('storage.items', { count: inventory.itemCount })}`}>
          <HardDrive size={20} color={colors.primary} strokeWidth={2} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.summaryTitle}>{t('storage.downloadedContent')}</Text>
            <Text style={styles.meta}>
              {t('storage.items', { count: inventory.itemCount })}
              {inventory.downloading > 0 ? ` · ${t('storage.downloadingCount', { count: inventory.downloading })}` : ''}
            </Text>
            {bytes !== null && inventory.itemCount > 0 ? <Text style={styles.meta}>{t('storage.dataSize', { size: formatBytes(bytes, units) })}</Text> : null}
          </View>
        </View>
        <Text style={styles.note}>{t('storage.offlineOnly')}</Text>

        {inventory.itemCount > 0 ? (
          <View style={styles.card}>
            {(['articles', 'places', 'collections'] as const).map((category) =>
              inventory.byCategory[category] > 0 ? (
                <View key={category} style={styles.line}>
                  <Text style={styles.lineTitle}>{t(`storage.category.${category}`)}</Text>
                  <Text style={styles.meta}>{inventory.byCategory[category]}</Text>
                </View>
              ) : null,
            )}
            {inventory.sharedCount > 0 ? <Text style={styles.meta}>{t('storage.sharedItems', { count: inventory.sharedCount })}</Text> : null}
          </View>
        ) : null}

        {packs.length > 0 ? (
          <View style={{ gap: spacing.xs }}>
            <Text style={styles.section} accessibilityRole="header">
              {t('storage.packs')}
            </Text>
            {packs.map((pack) => (
              <View key={pack.key} style={styles.pack}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.lineTitle}>{pack.name}</Text>
                  <Text style={styles.meta}>
                    {t(pack.type === 'path' ? 'storage.pathPack' : 'storage.regionPack')} · {t('storage.packItems', { count: pack.items })} · {statusLabel(pack.status)}
                  </Text>
                </View>
                {pack.status === 'partial' || pack.status === 'attention' ? (
                  <AnimatedPressable style={styles.icon} disabled={isOffline} onPress={() => void pack.retry()} accessibilityRole="button" accessibilityState={{ disabled: isOffline }} accessibilityLabel={`${t('storage.retry')}: ${pack.name}`}>
                    <RotateCw size={18} color={isOffline ? colors.textMuted : colors.primary} strokeWidth={2.25} />
                  </AnimatedPressable>
                ) : null}
                <AnimatedPressable style={styles.icon} onPress={() => setConfirm({ kind: 'pack', pack })} accessibilityRole="button" accessibilityLabel={`${t('storage.removeDownload')}: ${pack.name}`}>
                  <Trash2 size={18} color={colors.textSecondary} strokeWidth={2} />
                </AnimatedPressable>
              </View>
            ))}
          </View>
        ) : null}

        {attention.length > 0 ? (
          <View style={{ gap: spacing.xs }}>
            <Text style={styles.section} accessibilityRole="header">
              {t('storage.needsAttention')}
            </Text>
            {attention.map((item) => (
              <View key={item.id} style={styles.pack}>
                <Text style={[styles.lineTitle, { flex: 1 }]}>{t(`storage.kind.${item.kind}`)}</Text>
                <Button label={t('storage.retry')} variant="text" disabled={isOffline} onPress={() => void useOfflineStore.getState().download(item.kind, item.contentId)} />
                <Button label={t('storage.remove')} variant="text" onPress={() => useOfflineStore.getState().dismissFailed(item.id)} />
              </View>
            ))}
          </View>
        ) : null}
        {isOffline && (attention.length > 0 || packs.some((pack) => pack.status !== 'available')) ? <Text style={styles.note}>{t('storage.waitingForConnection')}</Text> : null}

        <SettingsSection footer={t('storage.cacheNote')}>
          {unused.length > 0 ? (
            <SettingsRow icon={Sparkles} label={t('storage.cleanUp')} subtitle={t('storage.unusedCount', { count: unused.length })} onPress={() => setConfirm({ kind: 'cleanup' })} />
          ) : (
            <SettingsRow icon={Sparkles} label={t('storage.cleanUp')} subtitle={t('storage.nothingToClean')} showChevron={false} />
          )}
          <SettingsRow icon={HardDrive} label={t('storage.manageDownloads')} onPress={() => router.push('/offline' as never)} />
          {inventory.itemCount > 0 || Object.keys(manifest.entries).length > 0 ? <SettingsRow icon={Trash2} label={t('storage.clearAll')} destructive onPress={() => setConfirm({ kind: 'clearAll' })} /> : null}
        </SettingsSection>
      </View>

      <ConfirmationModal
        visible={!!confirm}
        title={confirm?.kind === 'pack' ? `${t('storage.removeDownload')}: ${confirm.pack.name}` : confirm?.kind === 'cleanup' ? t('storage.cleanUp') : t('storage.clearAll')}
        message={confirm?.kind === 'pack' ? t('storage.removePackMessage') : confirm?.kind === 'cleanup' ? t('storage.cleanupPreview', { count: unused.length }) : t('storage.clearAllMessage')}
        confirmLabel={confirm?.kind === 'cleanup' ? t('storage.cleanUp') : t('storage.remove')}
        cancelLabel={t('common.cancel')}
        destructive
        isConfirming={busy}
        onConfirm={() => void runConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  summaryTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  lineTitle: { ...textStyles.bodyMedium, fontWeight: '600', color: colors.textPrimary },
  section: { ...typography.overline, color: colors.accentTerracotta },
  pack: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  meta: { ...textStyles.small, color: colors.textSecondary },
  note: { ...textStyles.small, color: colors.textMuted },
});
