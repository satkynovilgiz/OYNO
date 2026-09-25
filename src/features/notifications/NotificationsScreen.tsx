import { router } from 'expo-router';
import { Award, BellOff, ChevronLeft, CloudDownload, CloudOff, Gift, GraduationCap, Route, Sparkles, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState, FadeSlideIn, IconButton, TextLink } from '@/components/ui';
import { CHILD_DAILY_QUESTION_COUNT, DAILY_QUESTION_COUNT } from '@/features/challenges/challengeLogic';
import { getCollection } from '@/features/collections/collectionsData';
import { cultureItemImages } from '@/features/culture/data';
import { useTodayDiscovery } from '@/features/daily/useTodayDiscovery';
import { natureSiteImages } from '@/features/explore/data';
import { getAchievement } from '@/features/profile/data';
import { getTrail } from '@/features/trails/trailsData';
import type { SupportedLanguage } from '@/i18n';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { track } from '@/services/analytics/analytics';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useExploreRegions } from '@/services/content/exploreService';
import { mapExploreRegionName } from '@/services/content/types';
import { formatShortDate } from '@/services/i18n/formatDate';
import { localDateKey } from '@/services/daily/dailyDiscovery';
import { useNotificationsStore } from '@/store/useNotificationsStore';
import { colors, editorial, spacing, textStyles } from '@/theme';

import { groupInbox, type InboxItem, type InboxType } from './inbox';
import { NotificationRow } from './NotificationRow';
import { useInbox } from './useInbox';

const ICONS: Record<InboxType, LucideIcon> = {
  daily: Sparkles,
  gift: Gift,
  challenge: GraduationCap,
  trail: Route,
  achievement: Award,
  download: CloudDownload,
  downloadFailed: CloudOff,
  challengeDone: GraduationCap,
};

/**
 * Notifications - a calm personal activity inbox. Contents are real
 * (features/notifications/inbox.ts): today's actionable items first, then
 * what actually happened, grouped Today / Yesterday / This week / Earlier.
 * Opening the screen doesn't mark anything read; tapping a row does (and
 * opens its real destination); "Mark all as read" appears only when there
 * is something unread.
 */
export function NotificationsScreen({ onPressBack }: { onPressBack: () => void }) {
  useTrackScreenView('notifications');
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const { items, unread, readIds, isLoaded } = useInbox();
  const { discovery } = useTodayDiscovery();
  const { data: regions } = useExploreRegions();
  const { data: cultureItems } = useAllCultureItems();
  const isChild = experience === 'child';
  const now = new Date();

  function contentName(kind: string, id: string): string {
    if (kind === 'nature') {
      const row = regions?.find((region) => region.id === id);
      return row ? (mapExploreRegionName(row)[language] ?? row.name_kg) : t('notificationsScreen.v2.offlineContent');
    }
    if (kind === 'collection') {
      const collection = getCollection(id);
      return collection ? (collection.title[language] ?? collection.title.kg) : t('notificationsScreen.v2.offlineContent');
    }
    return cultureItems?.find((row) => row.id === id)?.title ?? t('notificationsScreen.v2.offlineContent');
  }

  function contentImage(kind: string, id: string): ImageSourcePropType | null {
    if (kind === 'nature') return natureSiteImages[id] ?? null;
    if (kind === 'collection') return getCollection(id)?.heroImage ?? null;
    return cultureItemImages[id]?.[0] ?? null;
  }

  function challengeTitle(key: string): string {
    if (key.startsWith('daily')) return t('challenges.daily.title');
    if (key.startsWith('collection:')) {
      const collection = getCollection(key.slice('collection:'.length));
      if (collection) return collection.title[language] ?? collection.title.kg;
    }
    return t('challenges.journey.title');
  }

  /** Title, body and optional artwork - resolved from ids at render time. */
  function present(item: InboxItem): { title: string; body: string | null; image: ImageSourcePropType | null } {
    const p = item.params;
    switch (item.type) {
      case 'daily':
        return { title: t('notificationsScreen.v2.daily.title'), body: discovery?.item.title ?? null, image: discovery?.imageSource ?? null };
      case 'gift':
        return { title: t('notificationsScreen.v2.gift.title'), body: t('notificationsScreen.v2.gift.body'), image: null };
      case 'challenge':
        return { title: t('notificationsScreen.v2.challenge.title'), body: t('notificationsScreen.v2.challenge.body', { count: isChild ? CHILD_DAILY_QUESTION_COUNT : DAILY_QUESTION_COUNT }), image: null };
      case 'trail': {
        const trail = getTrail(String(p.trailId));
        const title = trail ? (trail.title[language] ?? trail.title.kg) : '';
        return { title: t('notificationsScreen.v2.trail.title'), body: t('notificationsScreen.v2.trail.body', { title, completed: p.completed, total: p.total }), image: trail?.heroImage ?? null };
      }
      case 'achievement': {
        const achievement = getAchievement(String(p.achievementId));
        return { title: t('notificationsScreen.v2.achievement.title'), body: achievement ? t(achievement.titleKey) : null, image: achievement?.iconSource ?? null };
      }
      case 'download':
        return { title: t('notificationsScreen.v2.download.title'), body: contentName(String(p.kind), String(p.contentId)), image: contentImage(String(p.kind), String(p.contentId)) };
      case 'downloadFailed':
        return { title: t('notificationsScreen.v2.downloadFailed.title'), body: t('notificationsScreen.v2.downloadFailed.body', { name: contentName(String(p.kind), String(p.contentId)) }), image: null };
      case 'challengeDone':
        return { title: t('notificationsScreen.v2.challengeDone.title'), body: t('notificationsScreen.v2.challengeDone.body', { title: challengeTitle(String(p.challengeKey)), correct: p.correct, total: p.total }), image: null };
    }
  }

  function timeLabel(item: InboxItem): string | null {
    if (!item.createdAt) return null;
    const date = new Date(item.createdAt);
    const key = localDateKey(date);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (key === localDateKey(now) || key === localDateKey(yesterday)) return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    return formatShortDate(key, language);
  }

  function open(item: InboxItem) {
    useNotificationsStore.getState().markAsRead(item.id);
    track('notification_opened', { type: item.type });
    router.push(item.route as never);
  }

  const sections = groupInbox(items, now);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <View style={styles.topRow}>
          <IconButton icon={ChevronLeft} size={40} iconSize={20} shape="roundedSquare" elevated={false} accessibilityLabel={t('notificationsScreen.backLabel')} onPress={onPressBack} />
          {unread > 0 ? <TextLink label={t('notificationsScreen.v2.markAll')} onPress={() => useNotificationsStore.getState().markAllAsRead(items.map((item) => item.id))} /> : null}
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {t('notificationsScreen.title')}
        </Text>
      </View>

      {!isLoaded ? null : items.length === 0 ? (
        <FadeSlideIn style={styles.empty}>
          <EmptyState icon={BellOff} title={t('notificationsScreen.v2.emptyTitle')} description={t('notificationsScreen.v2.emptyBody')} />
          <View style={styles.emptyAction}>
            <Button label={t('notificationsScreen.v2.explore')} variant="secondary" onPress={() => router.push('/explore' as never)} />
          </View>
        </FadeSlideIn>
      ) : (
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
          {sections.map((section) => (
            <View key={section.id} style={styles.section}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                {t(`notificationsScreen.v2.sections.${section.id}`)}
              </Text>
              {section.items.map((item) => {
                const view = present(item);
                return (
                  <NotificationRow
                    key={item.id}
                    icon={ICONS[item.type]}
                    typeLabel={t(`notificationsScreen.v2.types.${item.type}`)}
                    title={view.title}
                    body={view.body}
                    image={view.image}
                    accent={item.type === 'gift' || item.type === 'achievement'}
                    timeLabel={timeLabel(item)}
                    unread={!readIds.includes(item.id)}
                    large={isChild}
                    bodyLines={isChild ? 1 : 2}
                    onPress={() => open(item)}
                  />
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...editorial(textStyles.h1), color: colors.textPrimary },
  list: { paddingHorizontal: spacing.sm, gap: spacing.md },
  section: { gap: 2 },
  sectionTitle: { ...textStyles.overline, color: colors.textSecondary, paddingHorizontal: spacing.sm, paddingBottom: spacing.xxs },
  empty: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.md, paddingBottom: spacing.xxxl },
  emptyAction: { alignItems: 'center', marginTop: spacing.sm },
});
