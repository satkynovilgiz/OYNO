import { router } from 'expo-router';
import { Award, ChevronRight, Coins, Compass, Flame, Gamepad2, Heart, MapPin, Settings, Trophy } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { AgeExperienceTransition, AnimatedPressable, FadeSlideIn, HeroEntrance, IconButton, MediaCard, ScreenEntrance, StatPill } from '@/components/ui';
import { computeCollectionProgress } from '@/features/collections/collectionProgress';
import { collections } from '@/features/collections/collectionsData';
import { useCollectionSignals } from '@/features/collections/useCollectionProgress';
import { natureSiteImages } from '@/features/explore/data';
import { buildPassport } from '@/features/journey/passport';
import { pickActiveQuest } from '@/features/quests/questProgress';
import { useQuestProgress } from '@/features/quests/useQuests';
import { useExploreRegions } from '@/services/content/exploreService';
import journeyBackdrop from '@assets/img/OYNO_design/explore/quest_boru_shyrdak.png';
import { mockGamesList } from '@/features/games/mockData';
import { progressGameIdFor } from '@/features/games/progressGameIds';
import { gameTitleKey } from '@/features/games/types';
import type { SupportedLanguage } from '@/i18n';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useDiscoveries } from '@/services/content/discoveriesService';
import { xpProgress } from '@/services/progress/levelConfig';
import { useAppStore } from '@/store/useAppStore';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useAuthStore } from '@/store/useAuthStore';
import { useAvatarStore } from '@/store/useAvatarStore';
import { useProgressStore } from '@/store/useProgressStore';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

import { AchievementsPreviewCard, FavoriteGamesCard, ProfileCollectionRow, ProfileIdentityCard } from './components';
import { achievementsTotal, getCollectionItems, profileAchievements } from './data';
import { getProfileSectionOrder, type ProfileSectionId } from './profileSections';
import type { FavoriteGame, ProfileSummary } from './types';

export function ProfileScreen() {
  useTrackScreenView('profile');
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const user = useAuthStore((state) => state.user);
  const characterId = useAppStore((state) => state.characterId) ?? 'bek';
  const avatarConfig = useAvatarStore((state) => (state.hasEverSaved ? state.config : null));
  const progress = useProgressStore();
  const { data: discoveries } = useDiscoveries();
  const { data: regions } = useExploreRegions();
  const collectionSignals = useCollectionSignals();
  const language = i18n.language as SupportedLanguage;

  const { level, xpCurrent, xpMax } = xpProgress(progress.xp);
  const profile: ProfileSummary = {
    characterId,
    avatarConfig,
    name: user?.name ?? t('common.guestName'),
    level,
    title: t('profile.rankTitle'),
    xpCurrent,
    xpMax,
    coins: progress.coins,
    tokens: progress.gems,
    streakDays: progress.streakDays,
  };

  const collectionItems = getCollectionItems(discoveries ?? [], progress.discoveredExploreIds, language);

  // Real stats only - and only the ones that say something (zeros hidden).
  const totalWins = Object.values(progress.gameStats).reduce((sum, stat) => sum + (stat?.won ?? 0), 0);
  const stats = [
    { id: 'games', icon: Gamepad2, value: progress.gamesPlayed, label: t('profile.v2.statGames'), color: colors.primary },
    { id: 'wins', icon: Trophy, value: totalWins, label: t('profile.v2.statWins'), color: colors.accentGoldPressed },
    { id: 'places', icon: MapPin, value: progress.visitedRegionIds.length, label: t('profile.v2.statPlaces'), color: colors.accentTerracotta },
    { id: 'achievements', icon: Award, value: progress.unlockedAchievementIds.length, label: t('profile.v2.statAchievements'), color: colors.accentGoldPressed },
    { id: 'streak', icon: Flame, value: progress.streakDays, label: t('profile.v2.statStreak'), color: colors.accentTerracotta },
    { id: 'coins', icon: Coins, value: progress.coins, label: t('profile.v2.statCoins'), color: colors.accentGoldPressed },
  ].filter((stat) => stat.value > 0);

  // My Journey entry: real Passport count + completed collections, with the
  // most recently visited place as artwork (else the journey backdrop).
  const passport = useMemo(
    () => buildPassport(regions ?? [], progress.visitedRegionIds, progress.regionVisitDates, (id) => natureSiteImages[id], language),
    [regions, progress.visitedRegionIds, progress.regionVisitDates, language],
  );
  const collectionsCompleted = collections.filter((collection) => computeCollectionProgress(collection, collectionSignals).status === 'completed').length;
  const latestVisit = Object.entries(progress.regionVisitDates).sort(([, a], [, b]) => b.localeCompare(a))[0]?.[0];
  const journeyImage = (latestVisit ? natureSiteImages[latestVisit] : undefined) ?? journeyBackdrop;

  const favoriteGames: FavoriteGame[] = mockGamesList
    .filter((game) => (progress.gameStats[progressGameIdFor(game.id)]?.played ?? 0) > 0)
    .map((game) => ({
      id: game.id,
      name: t(gameTitleKey(game.id)),
      thumbnail: game.thumbnail,
      gamesPlayed: progress.gameStats[progressGameIdFor(game.id)].played,
      wins: progress.gameStats[progressGameIdFor(game.id)].won,
      route: game.route,
    }));

  const questProgress = useQuestProgress();
  const activeQuest = pickActiveQuest(questProgress);
  const questsSummary = activeQuest
    ? t('quests.profileActive', { title: activeQuest.quest.title[i18n.language as 'kg' | 'ru' | 'en'] ?? activeQuest.quest.title.kg })
    : t('quests.profileCount', { completed: questProgress.filter((entry) => entry.status === 'completed').length, total: questProgress.length });

  function renderSection(id: ProfileSectionId) {
    switch (id) {
      case 'journey':
        return (
          <View key={id} style={styles.horizontalPad}>
            <MediaCard
              variant="landscape"
              aspectRatio={1.75}
              source={journeyImage}
              title={t('journey.title')}
              editorialTitle={experience === 'adult'}
              subtitle={t('profile.v2.journeySummary', { places: passport.unlocked, total: passport.total, collections: collectionsCompleted })}
              cta={t('journey.entryCta')}
              ctaSize="sm"
              ctaPlacement="inline"
              footer={<View />}
              onPress={() => router.push('/journey' as never)}
              accessibilityLabel={`${t('journey.title')}. ${t('profile.v2.journeySummary', { places: passport.unlocked, total: passport.total, collections: collectionsCompleted })}`}
            />
            {/* Short themed adventures - real counts only. */}
            <AnimatedPressable
              style={styles.questsRow}
              onPress={() => router.push('/quests' as never)}
              press="soft"
              accessibilityRole="button"
              accessibilityLabel={`${t('quests.title')}. ${questsSummary}`}
            >
              <Compass size={18} color={colors.primary} strokeWidth={2} />
              <View style={styles.questsText}>
                <Text style={styles.questsTitle}>{t('quests.title')}</Text>
                <Text style={styles.questsMeta} numberOfLines={1}>
                  {questsSummary}
                </Text>
              </View>
              <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
            </AnimatedPressable>
          </View>
        );
      case 'achievements':
        return (
          <View key={id} style={styles.horizontalPad}>
            <AchievementsPreviewCard
              achievements={profileAchievements}
              unlockedIds={progress.unlockedAchievementIds}
              unlocked={progress.unlockedAchievementIds.length}
              total={achievementsTotal}
              onPressSeeAll={() => router.push('/achievements' as never)}
            />
          </View>
        );
      case 'favorites':
        return (
          <View key={id} style={styles.horizontalPad}>
            <FavoriteGamesCard
              games={favoriteGames}
              onPressSeeAll={() => router.push('/games' as never)}
              onPressGame={(game) => {
                if (game.route) router.push(game.route as never);
              }}
            />
          </View>
        );
      case 'collection':
        return (
          <ProfileCollectionRow
            key={id}
            items={collectionItems}
            onPressItem={() => router.push('/collection' as never)}
            onPressSeeAll={() => router.push('/collection' as never)}
          />
        );
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xs }]}
      >
        <ScreenEntrance>
          {/* Compact top bar - Profile is identity/progress; everything
              configurable lives behind the one Settings action. */}
          <View style={styles.topBar}>
            <Text style={styles.topTitle} accessibilityRole="header">
              {t('profile.title')}
            </Text>
            <View style={styles.topActions}>
              <IconButton icon={Heart} size={40} iconSize={19} shape="roundedSquare" elevated={false} accessibilityLabel={t('saved.title')} onPress={() => router.push('/saved' as never)} />
              <IconButton icon={Settings} size={40} iconSize={19} shape="roundedSquare" elevated={false} accessibilityLabel={t('profile.settingsLabel')} onPress={() => router.push('/settings' as never)} />
            </View>
          </View>
        </ScreenEntrance>

        <HeroEntrance>
          <ProfileIdentityCard
            profile={profile}
            experience={experience}
            onPressAvatar={() => router.push('/avatar-editor' as never)}
            onPressEditName={() => router.push('/settings/account' as never)}
            stats={
              stats.length > 0 ? (
                <View style={styles.stats}>
                  {stats.map((stat) => (
                    <StatPill key={stat.id} icon={stat.icon} value={stat.value.toLocaleString('ru-RU')} label={stat.label} color={stat.color} />
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyStats}>{t('profile.v2.emptyStats')}</Text>
              )
            }
          />
        </HeroEntrance>

        <AgeExperienceTransition style={styles.sectionList}>
          {getProfileSectionOrder(experience).map((id, index) => (
            <FadeSlideIn key={id} index={index} staggerMs={40}>
              {renderSection(id)}
            </FadeSlideIn>
          ))}
        </AgeExperienceTransition>
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom }}>
        <BottomTabBar
          activeTab="profile"
          onPressTab={(tab) => {
            if (tab === 'home') router.push('/home');
            if (tab === 'games') router.push('/games' as never);
            if (tab === 'explore') router.push('/explore' as never);
            if (tab === 'culture') router.push('/culture' as never);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  questsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  questsText: { flex: 1, gap: 2 },
  questsTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  questsMeta: { ...textStyles.small, color: colors.textSecondary },
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionList: {
    gap: spacing.xl,
  },
  horizontalPad: {
    paddingHorizontal: spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  topTitle: {
    ...textStyles.h2,
    color: colors.textPrimary,
  },
  topActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  emptyStats: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
});
