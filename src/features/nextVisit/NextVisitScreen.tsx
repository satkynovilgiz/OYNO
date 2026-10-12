import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowDown, ArrowUp, CalendarPlus, ChevronLeft } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton, TextField } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { announce } from '@/services/a11y/announce';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { isRouteAvailableOffline } from '@/services/offline/offlineAvailability';
import { ownerQueue, useNextVisitStore } from '@/store/useNextVisitStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { itemKey, MAX_ITEMS, QUEUEABLE_ACTIVITIES, resolveItem, type ItemKind, type QueueChange, type QueueItem } from './nextVisitModel';

export const NEXT_VISIT_ROUTE = '/profile/next-visit';

function useNextVisit() {
  const owner = useRecordsOwner();
  const status = useNextVisitStore((state) => state.status);
  const raw = useNextVisitStore((state) => state.saved[owner]);
  const queue = useMemo(() => ownerQueue({ [owner]: raw } as never, owner), [owner, raw]);
  useEffect(() => {
    void useNextVisitStore.getState().load();
  }, []);
  return { owner, status, queue };
}

/** "Add to My Next Visit" for an article or activity. Shown as added only after the write succeeded. */
export function AddToNextVisit({ kind, id, title }: { kind: ItemKind; id: string; title: string }) {
  const { t } = useTranslation();
  const { owner, status, queue } = useNextVisit();
  const [failed, setFailed] = useState(false);
  const inQueue = queue.some((item) => itemKey(item) === itemKey({ kind, id }));
  const full = queue.length >= MAX_ITEMS;
  const add = async () => {
    const ok = await useNextVisitStore.getState().change(owner, { type: 'add', item: { kind, id, titleSnapshot: title }, now: new Date().toISOString() });
    setFailed(!ok);
    announce(ok ? t('nextVisit.added') : t('nextVisit.failed'));
  };
  if (status !== 'ready') return null;
  return (
    <View style={styles.inline}>
      {inQueue ? (
        <AnimatedPressable style={styles.inlineToggle} onPress={() => router.push(NEXT_VISIT_ROUTE as never)} accessibilityRole="link" testID={`next-visit-in-${id}`}>
          <CalendarPlus size={14} color={colors.primary} strokeWidth={2} />
          <Text style={[styles.inlineText, styles.link]}>{t('nextVisit.inPlan')}</Text>
        </AnimatedPressable>
      ) : (
        <Button label={full ? t('nextVisit.full', { max: MAX_ITEMS }) : t('nextVisit.add')} variant="secondary" disabled={full} onPress={add} testID={`next-visit-add-${id}`} />
      )}
      {failed ? <Text style={styles.warn}>{t('nextVisit.failed')}</Text> : null}
    </View>
  );
}

/* ---------- /profile/next-visit ---------- */

export function NextVisitScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { owner, status, queue } = useNextVisit();
  const items = useAllCultureItems();
  const queryClient = useQueryClient();
  const { isOffline } = useNetworkStatus();
  const [failed, setFailed] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [query, setQuery] = useState('');
  const articles = useMemo(() => new Map((items.data ?? []).map((item) => [item.id, item])), [items.data]);
  const article = (id: string) => (items.data ? (articles.get(id) ?? null) : items.isError ? null : undefined);

  const run = async (change: QueueChange, announceKey: string) => {
    const ok = await useNextVisitStore.getState().change(owner, change);
    setFailed(!ok);
    announce(ok ? t(announceKey) : t('nextVisit.failed'));
    return ok;
  };
  const titleOf = (item: QueueItem) => {
    const resolved = resolveItem(item, article);
    if (resolved?.titleKey) return t(resolved.titleKey);
    return resolved?.title ?? item.titleSnapshot ?? item.id;
  };
  const open = async (item: QueueItem) => {
    const resolved = resolveItem(item, article);
    if (!resolved) return;
    // Opening is NOT finishing: it only marks the item as opened.
    if (await run({ type: 'opened', key: itemKey(item), now: new Date().toISOString() }, 'nextVisit.openedAnnounce')) router.push(resolved.route as never);
  };

  const firstAvailable = queue.findIndex((item) => !!resolveItem(item, article));
  const lower = query.trim().toLowerCase();
  const articleMatches = lower ? (items.data ?? []).filter((item) => item.title.toLowerCase().includes(lower) && !queue.some((q) => itemKey(q) === itemKey({ kind: 'article', id: item.id }))).slice(0, 5) : [];
  const freeActivities = QUEUEABLE_ACTIVITIES.filter((activity) => !queue.some((q) => itemKey(q) === itemKey({ kind: 'activity', id: activity.id })));
  const full = queue.length >= MAX_ITEMS;
  const add = (kind: ItemKind, id: string, title: string) => run({ type: 'add', item: { kind, id, titleSnapshot: title }, now: new Date().toISOString() }, 'nextVisit.added');

  let body: React.ReactNode;
  if (status === 'error') {
    body = (
      <View style={styles.stack} testID="next-visit-load-error">
        <Text style={styles.warn}>{t('nextVisit.loadError')}</Text>
        <Button label={t('common.retry')} onPress={() => void useNextVisitStore.getState().retryLoad()} />
      </View>
    );
  } else if (status !== 'ready') {
    body = <Text style={styles.meta}>{t('nextVisit.loading')}</Text>;
  } else {
    body = (
      <View style={styles.stack}>
        {queue.length === 0 ? (
          <Text style={styles.meta} testID="next-visit-empty">
            {t('nextVisit.empty')}
          </Text>
        ) : (
          <View style={styles.stack} testID="next-visit-queue">
            {queue.map((item, index) => {
              const key = itemKey(item);
              const resolved = resolveItem(item, article);
              const isNext = index === firstAvailable;
              const offlineOk = resolved ? isRouteAvailableOffline(resolved.route, queryClient) : false;
              return (
                <View key={key} style={[styles.card, isNext && styles.cardNext]} testID={`next-visit-item-${index}`}>
                  <Text style={styles.label}>
                    {index + 1}. {t(`nextVisit.kind.${item.kind}`)}
                    {isNext ? ` · ${t('nextVisit.nextUp')}` : ''}
                  </Text>
                  <Text style={styles.cardTitle}>{titleOf(item)}</Text>
                  {resolved === null ? (
                    <Text style={styles.warn} testID={`next-visit-unavailable-${index}`}>
                      {t('nextVisit.unavailable')}
                    </Text>
                  ) : null}
                  {resolved === undefined ? <Text style={styles.meta}>{t('nextVisit.loading')}</Text> : null}
                  {resolved && isOffline ? <Text style={styles.meta}>{offlineOk ? t('nextVisit.worksOffline') : t('nextVisit.needsConnection')}</Text> : null}

                  {resolved && item.openedAt ? (
                    <View style={styles.stack} testID={`next-visit-choice-${index}`}>
                      <Text style={styles.body}>{t('nextVisit.howDidItGo')}</Text>
                      <View style={styles.wrap}>
                        <Button label={t('nextVisit.finished')} size="sm" onPress={() => void run({ type: 'finish', key }, 'nextVisit.finishedAnnounce')} testID={`next-visit-finish-${index}`} />
                        <Button label={t('nextVisit.skip')} variant="secondary" size="sm" onPress={() => void run({ type: 'skip', key }, 'nextVisit.skippedAnnounce')} testID={`next-visit-skip-${index}`} />
                        <Button label={t('nextVisit.later')} variant="secondary" size="sm" onPress={() => void run({ type: 'later', key }, 'nextVisit.laterAnnounce')} testID={`next-visit-later-${index}`} />
                      </View>
                      <Button label={t('nextVisit.openAgain')} variant="text" size="sm" disabled={isOffline && !offlineOk} onPress={() => void open(item)} testID={`next-visit-reopen-${index}`} />
                    </View>
                  ) : resolved ? (
                    <Button label={isNext ? t('nextVisit.start') : t('nextVisit.open')} variant={isNext ? 'primary' : 'secondary'} size="sm" disabled={isOffline && !offlineOk} onPress={() => void open(item)} testID={`next-visit-open-${index}`} />
                  ) : null}

                  <View style={styles.wrap}>
                    <IconButton icon={ArrowUp} shape="roundedSquare" accessibilityLabel={t('nextVisit.moveUp', { title: titleOf(item) })} disabled={index === 0} onPress={() => void run({ type: 'move', key, by: -1 }, 'nextVisit.movedAnnounce')} testID={`next-visit-up-${index}`} />
                    <IconButton icon={ArrowDown} shape="roundedSquare" accessibilityLabel={t('nextVisit.moveDown', { title: titleOf(item) })} disabled={index === queue.length - 1} onPress={() => void run({ type: 'move', key, by: 1 }, 'nextVisit.movedAnnounce')} testID={`next-visit-down-${index}`} />
                    <Button label={t('nextVisit.remove')} variant="text" size="sm" onPress={() => void run({ type: 'remove', key }, 'nextVisit.removedAnnounce')} testID={`next-visit-remove-${index}`} />
                  </View>
                </View>
              );
            })}
          </View>
        )}
        {failed ? (
          <Text style={styles.warn} accessibilityLiveRegion="polite" testID="next-visit-failed">
            {t('nextVisit.failed')}
          </Text>
        ) : null}

        {queue.length ? (
          confirmClear ? (
            <View style={styles.card} testID="next-visit-clear-confirm">
              <Text style={styles.body}>{t('nextVisit.clearConfirm', { count: queue.length })}</Text>
              <View style={styles.wrap}>
                <Button
                  label={t('nextVisit.clearYes')}
                  onPress={async () => {
                    if (await run({ type: 'clear' }, 'nextVisit.clearedAnnounce')) setConfirmClear(false);
                  }}
                  testID="next-visit-clear-yes"
                />
                <Button label={t('common.cancel')} variant="text" onPress={() => setConfirmClear(false)} />
              </View>
            </View>
          ) : (
            <Button label={t('nextVisit.clear')} variant="text" onPress={() => setConfirmClear(true)} testID="next-visit-clear" />
          )
        ) : null}

        <Text style={styles.section} accessibilityRole="header">
          {t('nextVisit.addTitle')}
        </Text>
        {full ? (
          <Text style={styles.meta}>{t('nextVisit.full', { max: MAX_ITEMS })}</Text>
        ) : (
          <>
            <TextField label={t('nextVisit.findArticle')} value={query} onChangeText={setQuery} placeholder={t('nextVisit.findPlaceholder')} testID="next-visit-search" />
            {articleMatches.map((item) => (
              <AnimatedPressable key={item.id} style={styles.pick} onPress={async () => (await add('article', item.id, item.title)) && setQuery('')} accessibilityRole="button" accessibilityLabel={t('nextVisit.addA11y', { title: item.title })} testID={`next-visit-add-article-${item.id}`}>
                <Text style={styles.body}>+ {item.title}</Text>
              </AnimatedPressable>
            ))}
            <Text style={styles.meta}>{t('nextVisit.activitiesTitle')}</Text>
            {freeActivities.map((activity) => (
              <AnimatedPressable key={activity.id} style={styles.pick} onPress={() => void add('activity', activity.id, t(activity.titleKey ?? ''))} accessibilityRole="button" accessibilityLabel={t('nextVisit.addA11y', { title: t(activity.titleKey ?? '') })} testID={`next-visit-add-activity-${activity.id}`}>
                <Text style={styles.body}>+ {activity.titleKey ? t(activity.titleKey) : activity.id}</Text>
              </AnimatedPressable>
            ))}
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
          {t('nextVisit.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled" testID="next-visit">
        <Text style={styles.body}>{t('nextVisit.intro')}</Text>
        <Text style={styles.note}>{t('nextVisit.personal')}</Text>
        {body}
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
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.sm },
  label: { ...textStyles.overline, color: colors.primary },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  link: { color: colors.primary, fontWeight: '700' },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardNext: { borderColor: colors.primary, borderWidth: 2 },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  pick: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: cardRadii.compact, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  inline: { gap: spacing.xs },
  inlineToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' },
  inlineText: { ...textStyles.small, color: colors.textSecondary },
});
