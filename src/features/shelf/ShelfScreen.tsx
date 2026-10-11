import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Cloud, Smartphone } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton, TextField } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import type { SupportedLanguage } from '@/i18n';
import { fetchOymoCreations } from '@/services/content/oymoCreationsService';
import { formatShortDate, localDateKeyOf } from '@/services/i18n/formatDate';
import { ownerCapsules, useCapsuleStore } from '@/store/useCapsuleStore';
import { ownerBoards, useDiscoveryBoardStore } from '@/store/useDiscoveryBoardStore';
import { ownerCollections, useMyCollectionsStore } from '@/store/useMyCollectionsStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { boardItems, capsuleItems, designItems, exhibitionItems, SHELF_TYPES, shelfView, SORTS, type ShelfItem, type ShelfType, type SortKey, type SourceState } from './shelfModel';

const CREATE_ROUTE: Record<ShelfType, string> = { design: '/culture/oymo/create', exhibition: '/profile/my-collections', board: '/culture/board', capsule: '/profile/capsules/new' };

/** Each source on its own: loading, ready, error (with retry) or not available - independently. */
function useShelfSources(owner: string): Record<ShelfType, SourceState> {
  const signedIn = owner !== 'guest';
  // Saved designs live in the account (RLS: the signed-in user's rows). Keyed by OWNER, so another
  // account's cached list can never show here after a switch.
  const designs = useQuery({ queryKey: ['oymo_creations', 'shelf', owner], queryFn: fetchOymoCreations, enabled: signedIn });
  const collectionsLoaded = useMyCollectionsStore((state) => state.isLoaded);
  const collections = useMyCollectionsStore((state) => state.saved);
  const museums = useMyCollectionsStore((state) => state.museums);
  const boardStatus = useDiscoveryBoardStore((state) => state.status);
  const boards = useDiscoveryBoardStore((state) => state.saved);
  const capsuleStatus = useCapsuleStore((state) => state.status);
  const capsules = useCapsuleStore((state) => state.saved);
  useEffect(() => {
    void useMyCollectionsStore.getState().load();
    void useDiscoveryBoardStore.getState().load();
    void useCapsuleStore.getState().load();
  }, []);
  return useMemo(
    () => ({
      design: !signedIn ? { status: 'unavailable', reason: 'signedOut' } : designs.isError ? { status: 'error', retry: () => void designs.refetch() } : designs.data ? { status: 'ready', items: designItems(designs.data) } : { status: 'loading' },
      exhibition: collectionsLoaded ? { status: 'ready', items: exhibitionItems(museums[owner], ownerCollections(collections, owner)) } : { status: 'loading' },
      board: boardStatus === 'error' ? { status: 'error', retry: () => void useDiscoveryBoardStore.getState().retryLoad() } : boardStatus === 'ready' ? { status: 'ready', items: boardItems(ownerBoards(boards, owner)) } : { status: 'loading' },
      capsule:
        capsuleStatus === 'error'
          ? {
              status: 'error',
              retry: () => {
                useCapsuleStore.setState({ status: 'idle' });
                void useCapsuleStore.getState().load();
              },
            }
          : capsuleStatus === 'ready'
            ? { status: 'ready', items: capsuleItems(ownerCapsules(capsules, owner)) }
            : { status: 'loading' },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signedIn, owner, designs.isError, designs.data, collectionsLoaded, collections, museums, boardStatus, boards, capsuleStatus, capsules],
  );
}

/**
 * /profile/shelf - My OYNO Shelf: saved Oymo designs, Mini Museum
 * exhibitions, Discovery Boards and Time Capsules of the CURRENT owner, in
 * one list (no data copied). Filter, search titles, sort; each item opens
 * in its existing screen. Sealed capsules show only allowed metadata.
 */
export function ShelfScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const owner = useRecordsOwner();
  const sources = useShelfSources(owner);
  const [type, setType] = useState<ShelfType | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('updated');

  const all = SHELF_TYPES.flatMap((entry) => {
    const state = sources[entry];
    return state.status === 'ready' ? state.items : [];
  });
  const shown = shelfView(all, { type, query, sort });
  const typesInView = type === 'all' ? SHELF_TYPES : [type];
  const date = (value: string | null) => {
    const key = value ? localDateKeyOf(value) : null;
    return key ? formatShortDate(key, language) : t('shelf.noDate');
  };
  const detailText = (item: ShelfItem) => {
    if (!item.detail) return '';
    const params = item.detail.params ?? {};
    return t(item.detail.key, item.detail.key === 'shelf.detail.sealedUntil' && typeof params.date === 'string' && params.date ? { date: formatShortDate(params.date, language) } : params);
  };

  const chip = (id: string, label: string, on: boolean, onPress: () => void, testID: string) => (
    <AnimatedPressable key={id} style={[styles.chip, on && styles.chipOn]} onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} testID={testID}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </AnimatedPressable>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
          {t('shelf.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled" testID="shelf">
        <Text style={styles.meta}>{t('shelf.intro')}</Text>
        <Text style={styles.section}>{t('shelf.filter')}</Text>
        <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={t('shelf.filter')}>
          {chip('all', t('shelf.types.all'), type === 'all', () => setType('all'), 'shelf-filter-all')}
          {SHELF_TYPES.map((entry) => chip(entry, t(`shelf.types.${entry}`), type === entry, () => setType(entry), `shelf-filter-${entry}`))}
        </View>
        <TextField testID="shelf-search" label={t('shelf.search')} value={query} onChangeText={setQuery} placeholder={t('shelf.searchPlaceholder')} />
        <Text style={styles.section}>{t('shelf.sort')}</Text>
        <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={t('shelf.sort')}>
          {SORTS.map((entry) => chip(entry, t(`shelf.sorts.${entry}`), sort === entry, () => setSort(entry), `shelf-sort-${entry}`))}
        </View>

        {/* Every source's own state: a failure never hides what did load, and isn't shown as "empty". */}
        {typesInView.map((entry) => {
          const state = sources[entry];
          if (state.status === 'loading') return <Text key={entry} style={styles.meta} testID={`shelf-loading-${entry}`}>{t('shelf.loading', { type: t(`shelf.types.${entry}`) })}</Text>;
          if (state.status === 'error')
            return (
              <View key={entry} style={[styles.card, styles.error]} testID={`shelf-error-${entry}`}>
                <Text style={styles.body}>{t('shelf.error', { type: t(`shelf.types.${entry}`) })}</Text>
                <Button label={t('shelf.retry')} size="sm" onPress={state.retry} testID={`shelf-retry-${entry}`} />
              </View>
            );
          if (state.status === 'unavailable')
            return (
              <View key={entry} style={styles.card} testID={`shelf-unavailable-${entry}`}>
                <Text style={styles.body}>{t('shelf.signedOut')}</Text>
              </View>
            );
          if (state.items.length === 0)
            return (
              <View key={entry} style={styles.card} testID={`shelf-empty-${entry}`}>
                <Text style={styles.body}>{t(`shelf.empty.${entry}`)}</Text>
                <Button label={t(`shelf.create.${entry}`)} variant="secondary" size="sm" onPress={() => router.push(CREATE_ROUTE[entry] as never)} testID={`shelf-create-${entry}`} />
              </View>
            );
          return null;
        })}

        {query.trim() && shown.length === 0 ? <Text style={styles.body} testID="shelf-no-match">{t('shelf.noMatch')}</Text> : null}
        <View style={styles.list} testID="shelf-list">
          {shown.map((item) => {
            const name = item.title ?? t(`shelf.untitled.${item.type}`);
            const storage = item.storage === 'cloud' ? t('shelf.storage.cloud') : t('shelf.storage.device');
            return (
              <AnimatedPressable key={item.key} style={styles.row} onPress={() => router.push(item.route as never)} accessibilityRole="button" accessibilityLabel={`${name}. ${t(`shelf.types.${item.type}`)}. ${detailText(item)}. ${storage}. ${t('shelf.updated', { date: date(item.updatedAt) })}`} testID={`shelf-item-${item.key}`}>
                <View style={styles.flex}>
                  <Text style={styles.typeLabel}>{t(`shelf.types.${item.type}`)}</Text>
                  <Text style={[styles.itemTitle, item.title === null && styles.untitled]} numberOfLines={2}>
                    {name}
                  </Text>
                  <Text style={styles.meta}>
                    {detailText(item)} · {t('shelf.updated', { date: date(item.updatedAt) })}
                  </Text>
                  <View style={styles.inline}>
                    {item.storage === 'cloud' ? <Cloud size={12} color={colors.textSecondary} strokeWidth={2} /> : <Smartphone size={12} color={colors.textSecondary} strokeWidth={2} />}
                    <Text style={styles.meta}>{storage}</Text>
                  </View>
                </View>
                <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
              </AnimatedPressable>
            );
          })}
        </View>
        <Text style={styles.meta}>{t('shelf.note')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flex: { flex: 1, gap: 2 },
  list: { gap: spacing.sm },
  section: { ...typography.overline, color: colors.textSecondary },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  typeLabel: { ...textStyles.overline, color: colors.primary },
  itemTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  untitled: { fontStyle: 'italic', fontWeight: '400' },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  error: { borderLeftWidth: 4, borderLeftColor: colors.accentTerracotta },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  chipTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
});
