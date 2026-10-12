import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { announce } from '@/services/a11y/announce';
import { useOymoCreations } from '@/services/content/oymoCreationsService';
import { handOffToCreator } from '@/services/culture/oymoHandoff';
import { ownerMilestones, useOymoMilestonesStore } from '@/store/useOymoMilestonesStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { OymoArtwork } from '../components/OymoArtwork';
import { OYMO_MOTIFS } from '../motifs';
import { compareSnapshots, milestonesRoute, toCreatorCopy, type Difference, type Milestone } from './milestonesModel';

function useMilestones() {
  const owner = useRecordsOwner();
  const status = useOymoMilestonesStore((state) => state.status);
  const raw = useOymoMilestonesStore((state) => state.saved[owner]);
  const all = useMemo(() => ownerMilestones({ [owner]: raw } as never, owner), [owner, raw]);
  useEffect(() => {
    void useOymoMilestonesStore.getState().load();
  }, []);
  return { owner, status, all };
}

function Header({ title, onPressBack }: { title: string; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}

/* ---------- /culture/oymo/milestones ---------- */

export function MilestoneDesignsScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { status, all } = useMilestones();
  const creations = useOymoCreations();
  return (
    <View style={styles.root}>
      <Header title={t('milestones.title')} onPressBack={onPressBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="milestone-designs">
        <Text style={styles.body}>{t('milestones.intro')}</Text>
        <Text style={styles.note}>{t('milestones.storage')}</Text>
        {status === 'error' ? <Text style={styles.warn}>{t('milestones.loadError')}</Text> : null}
        {status === 'ready' && Object.keys(all).length === 0 ? <Text style={styles.meta}>{t('milestones.noneYet')}</Text> : null}
        {Object.entries(all).map(([creationId, list]) => {
          const parent = creations.data?.find((row) => row.id === creationId);
          return (
            <AnimatedPressable key={creationId} style={styles.card} onPress={() => router.push(milestonesRoute(creationId) as never)} accessibilityRole="button" testID={`milestone-design-${creationId}`}>
              <View style={styles.row}>
                <Text style={[styles.cardTitle, styles.flex]}>{parent ? parent.name || t('milestones.untitled') : creations.data ? t('milestones.parentDeleted') : t('milestones.loading')}</Text>
                <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
              </View>
              <Text style={styles.meta}>{t('milestones.count', { count: list.length })}</Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ---------- /culture/oymo/milestones/[creationId] ---------- */

export function MilestoneGalleryScreen({ creationId, onPressBack }: { creationId: string; onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { owner, status, all } = useMilestones();
  const creations = useOymoCreations();
  const list = all[creationId] ?? [];
  const parent = creations.data?.find((row) => row.id === creationId) ?? null;
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<string | 'all' | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => setSelected([]), [owner, creationId]);
  const byId = (id: string) => list.find((m) => m.id === id) ?? null;
  const date = (iso: string) => (Number.isNaN(Date.parse(iso)) ? '' : new Intl.DateTimeFormat(i18n.language === 'kg' ? 'ky' : i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)));
  const name = (m: Milestone, index: number) => m.label || t('milestones.numbered', { n: index + 1 });
  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current.slice(-1), id]));
  const pair = selected.length === 2 ? ([byId(selected[0]), byId(selected[1])].filter(Boolean) as Milestone[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : [];
  const differences: Difference[] = pair.length === 2 ? compareSnapshots(pair[0].snapshot, pair[1].snapshot) : [];
  const motifName = (id: string) => {
    const motif = OYMO_MOTIFS.find((m) => m.id === id);
    return motif ? t(motif.nameKey) : id;
  };
  const describe = (d: Difference) => (d.kind === 'background' || d.kind === 'symmetry' ? t(`milestones.diff.${d.kind}`, { from: d.kind === 'symmetry' ? t(`culture.oymo.symmetry.${d.from}`) : d.from, to: d.kind === 'symmetry' ? t(`culture.oymo.symmetry.${d.to}`) : d.to }) : t(`milestones.diff.${d.kind}`, { motif: motifName(d.motifId), from: 'from' in d ? (d.kind === 'motif' ? motifName(d.from) : d.from) : '', to: 'to' in d ? (d.kind === 'motif' ? motifName(d.to) : d.to) : '' }));
  const openCopy = (m: Milestone) => {
    const copy = toCreatorCopy(m);
    handOffToCreator(copy.state, { symmetry: copy.symmetry, source: 'milestone', name: m.label || undefined });
    router.push('/culture/oymo/create' as never);
  };
  const remove = async (target: string | 'all') => {
    const ok = target === 'all' ? await useOymoMilestonesStore.getState().removeAll(owner, creationId) : await useOymoMilestonesStore.getState().remove(owner, creationId, target);
    setFailed(!ok);
    if (ok) {
      setConfirm(null);
      setSelected((current) => current.filter((id) => id !== target));
      announce(t('milestones.deleted'));
      if (target === 'all') router.replace('/culture/oymo/milestones' as never);
    }
  };
  const thumb = Math.min((width - spacing.lg * 2 - spacing.sm) / 2, 180);

  return (
    <View style={styles.root}>
      <Header title={parent ? parent.name || t('milestones.untitled') : t('milestones.title')} onPressBack={onPressBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="milestone-gallery-screen">
        <Text style={styles.note}>{t('milestones.storage')}</Text>
        {creations.data && !parent ? (
          <Text style={styles.warn} testID="milestone-parent-deleted">
            {t('milestones.parentDeletedLong')}
          </Text>
        ) : null}
        {status !== 'ready' ? <Text style={styles.meta}>{status === 'error' ? t('milestones.loadError') : t('milestones.loading')}</Text> : null}
        {status === 'ready' && list.length === 0 ? <Text style={styles.meta}>{t('milestones.noneHere')}</Text> : null}
        {list.length >= 2 ? <Text style={styles.meta}>{t('milestones.pickTwo')}</Text> : null}

        {list.map((m, index) => {
          const isSelected = selected.includes(m.id);
          return (
            <View key={m.id} style={[styles.card, isSelected && styles.cardOn]} testID={`milestone-${index}`}>
              <View style={styles.row}>
                <OymoArtwork layers={m.snapshot.layers} backgroundColor={m.snapshot.backgroundColor} symmetryMode={m.snapshot.symmetry} size={72} />
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>{name(m, index)}</Text>
                  <Text style={styles.meta}>{date(m.createdAt)}</Text>
                  <Text style={styles.meta}>{t('milestones.layers', { count: m.snapshot.layers.length })}</Text>
                </View>
              </View>
              <View style={styles.wrapRow}>
                <AnimatedPressable style={[styles.check, isSelected && styles.checkOn]} onPress={() => toggle(m.id)} accessibilityRole="checkbox" accessibilityState={{ checked: isSelected }} aria-checked={isSelected} accessibilityLabel={t('milestones.compareA11y', { name: name(m, index) })} testID={`milestone-select-${index}`}>
                  <Text style={[styles.checkText, isSelected && styles.checkTextOn]}>{t('milestones.compareThis')}</Text>
                </AnimatedPressable>
                <Button label={t('milestones.openCopy')} variant="secondary" size="sm" onPress={() => openCopy(m)} testID={`milestone-open-copy-${index}`} />
                <Button label={t('milestones.delete')} variant="text" size="sm" onPress={() => setConfirm(m.id)} testID={`milestone-delete-${index}`} />
              </View>
              {confirm === m.id ? (
                <View style={styles.confirm} testID={`milestone-delete-confirm-${index}`}>
                  <Text style={styles.body}>{t('milestones.deleteConfirm', { name: name(m, index) })}</Text>
                  <View style={styles.wrapRow}>
                    <Button label={t('milestones.deleteYes')} size="sm" onPress={() => void remove(m.id)} testID={`milestone-delete-yes-${index}`} />
                    <Button label={t('common.cancel')} variant="text" size="sm" onPress={() => setConfirm(null)} />
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
        {failed ? <Text style={styles.warn}>{t('milestones.result.failed')}</Text> : null}

        {pair.length === 2 ? (
          <View style={styles.stack} testID="milestone-compare">
            <Text style={styles.section} accessibilityRole="header">
              {t('milestones.compareTitle', { a: name(pair[0], list.indexOf(pair[0])), b: name(pair[1], list.indexOf(pair[1])) })}
            </Text>
            <View style={styles.compare}>
              {pair.map((m) => (
                <View key={m.id} style={styles.compareCell} accessible accessibilityRole="image" accessibilityLabel={name(m, list.indexOf(m))}>
                  <OymoArtwork layers={m.snapshot.layers} backgroundColor={m.snapshot.backgroundColor} symmetryMode={m.snapshot.symmetry} size={thumb} />
                  <Text style={styles.meta}>{name(m, list.indexOf(m))}</Text>
                </View>
              ))}
            </View>
            {differences.length === 0 ? (
              <Text style={styles.body} testID="milestone-no-diff">
                {t('milestones.noDiff')}
              </Text>
            ) : (
              differences.map((d, index) => (
                <Text key={index} style={styles.body} testID="milestone-diff">
                  • {describe(d)}
                </Text>
              ))
            )}
            <Text style={styles.meta}>{t('milestones.diffNote')}</Text>
          </View>
        ) : null}

        {creations.data && !parent && list.length ? (
          confirm === 'all' ? (
            <View style={styles.confirm}>
              <Text style={styles.body}>{t('milestones.deleteAllConfirm', { count: list.length })}</Text>
              <View style={styles.wrapRow}>
                <Button label={t('milestones.deleteYes')} size="sm" onPress={() => void remove('all')} testID="milestone-delete-all-yes" />
                <Button label={t('common.cancel')} variant="text" size="sm" onPress={() => setConfirm(null)} />
              </View>
            </View>
          ) : (
            <Button label={t('milestones.deleteAll')} variant="text" onPress={() => setConfirm('all')} testID="milestone-delete-all" />
          )
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  stack: { gap: spacing.sm },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.sm },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardOn: { borderColor: colors.primary, borderWidth: 2 },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  confirm: { gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  check: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  checkTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
  compare: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  compareCell: { alignItems: 'center', gap: spacing.xs },
});
