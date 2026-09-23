import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, Clock, Sparkles, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, Badge, Button, EmptyState, FadeSlideIn, IconButton } from '@/components/ui';
import { interactiveExperienceForCategory, routeForInteractiveExperience } from '@/features/culture/interactiveExperiences';
import { mockGamesList } from '@/features/games/mockData';
import { gameTitleKey } from '@/features/games/types';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { buildImageChallenge } from '@/services/daily/dailyDiscovery';
import { useDailyDiscoveryStore } from '@/store/useDailyDiscoveryStore';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

import { dailyHasChallenge } from './dailyContent';
import { dailyImageOf, useTodayDiscovery, type TodayDiscovery } from './useTodayDiscovery';

/** Culture items that have their own playable game - the same pairings the
 * "Horse Culture" collection already makes (collectionsData.ts). */
const RELATED_GAME_BY_ITEM: Record<string, string> = {
  'horse-kok-boru': 'kok-boru',
  'horse-kyz-kuumai': 'kyz-kuumay',
};

type DailyDiscoveryScreenProps = {
  onPressBack: () => void;
};

/**
 * "Daily OYNO" - one focused, 1-3 minute look at a single real culture
 * item (spec "When opened: show a focused Daily Discovery screen"). The
 * text is the item's own stored fields (see dailyContent.ts), the
 * challenge is built from real bundled photos, and completion feeds the
 * EXISTING progress path (`discoverCulture` - the same action Culture's
 * today-discovery card uses, which also advances the existing server-side
 * streak and can unlock the existing Komuzchu achievement) instead of a
 * new reward/streak system.
 */
export function DailyDiscoveryScreen({ onPressBack }: DailyDiscoveryScreenProps) {
  useTrackScreenView('daily_discovery');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isLoading, discovery } = useTodayDiscovery();

  return (
    <View style={styles.root}>
      {isLoading ? (
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : discovery ? (
        <DailyDiscoveryContent key={discovery.dateKey} discovery={discovery} onPressBack={onPressBack} />
      ) : (
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <EmptyState
            icon={TriangleAlert}
            title={t('daily.unavailableTitle')}
            description={t('daily.unavailableDescription')}
            actionLabel={t('common.back')}
            onPressAction={onPressBack}
          />
        </View>
      )}
    </View>
  );
}

function DailyDiscoveryContent({ discovery, onPressBack }: { discovery: TodayDiscovery; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const { item } = discovery;

  const hasChallenge = dailyHasChallenge(experience) && !discovery.isCompleted;
  const [challenge] = useState(() => buildImageChallenge(item, discovery.pool, discovery.dateKey, dailyImageOf));
  // A challenge with fewer than 2 photos isn't a choice - skip it rather
  // than show a one-option "quiz".
  const challengeUsable = hasChallenge && challenge.length >= 2;
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [solved, setSolved] = useState(false);
  const [completing, setCompleting] = useState(false);

  const canComplete = !challengeUsable || solved;
  const isAdult = experience === 'adult';

  const experienceRef = interactiveExperienceForCategory(item.category_id);
  const experienceRoute = experienceRef ? routeForInteractiveExperience(experienceRef.id) : null;
  const relatedGame = mockGamesList.find((game) => game.id === RELATED_GAME_BY_ITEM[item.id] && game.route);

  function handleAnswer(itemId: string, correct: boolean) {
    if (solved) return;
    if (correct) setSolved(true);
    else if (!wrongIds.includes(itemId)) setWrongIds([...wrongIds, itemId]);
  }

  async function handleComplete() {
    if (!canComplete || completing) return;
    setCompleting(true);
    await useDailyDiscoveryStore.getState().complete(discovery.dateKey, item.id);
    // Existing progress, not a new system: counts as a culture discovery
    // (and as today's activity for the existing streak), and reports the
    // same OPEN_CULTURE_ITEM quest event opening this item normally does.
    // Both are no-ops for guests, matching the rest of the app.
    void useProgressStore.getState().discoverCulture();
    void useProgressStore.getState().advanceQuestStep('OPEN_CULTURE_ITEM', item.id);
    setCompleting(false);
  }

  const meta = [t('daily.minutes', { count: discovery.minutes }), discovery.categoryTitle].filter(Boolean).join(' • ');

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Image source={discovery.imageSource} style={styles.heroImage} resizeMode="cover" />
        <LinearGradient colors={['rgba(19,32,24,0.35)', 'rgba(19,32,24,0)', 'rgba(19,32,24,0.92)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
        <View style={[styles.heroOverlay, { paddingTop: insets.top + spacing.sm }]}>
          <IconButton icon={ChevronLeft} shape="roundedSquare" variant="surface" accessibilityLabel={t('common.back')} onPress={onPressBack} />
          <View style={styles.heroText}>
            <View style={styles.overlineRow}>
              <OymoOrnament size={11} color={colors.accentGold} strokeWidth={1.75} />
              <Text style={styles.overline}>{t('daily.overline')}</Text>
            </View>
            <Text style={styles.heroTitle}>{item.title}</Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Clock size={14} color={colors.textSecondary} strokeWidth={2} />
          <Text style={styles.meta}>{meta}</Text>
          {item.accuracy_level === 'partially_verified' ? (
            <Badge label={t('culture.item.accuracy.partially_verified')} color={colors.surfaceAlt} textColor={colors.textSecondary} />
          ) : null}
        </View>

        {discovery.textBlocks.map((block, index) => (
          <FadeSlideIn key={`${block.labelKey ?? 'lead'}-${index}`} index={index} style={styles.block}>
            {block.labelKey ? <Text style={styles.blockLabel}>{t(block.labelKey)}</Text> : null}
            <Text style={[styles.blockText, isAdult && styles.blockTextEditorial, experience === 'child' && styles.blockTextChild]}>{block.text}</Text>
          </FadeSlideIn>
        ))}

        {challengeUsable ? (
          <View style={styles.challenge}>
            <View style={styles.challengeHeader}>
              <Sparkles size={16} color={colors.accentTerracotta} strokeWidth={2} />
              <Text style={styles.challengeQuestion}>{t('daily.challenge.question', { title: item.title })}</Text>
            </View>
            <View style={styles.challengeRow}>
              {challenge.map((option) => {
                const image = dailyImageOf(option.itemId);
                if (!image) return null;
                const isWrong = wrongIds.includes(option.itemId);
                const isRight = solved && option.correct;
                return (
                  <AnimatedPressable
                    key={option.itemId}
                    style={[styles.option, isWrong && styles.optionWrong, isRight && styles.optionRight]}
                    onPress={() => handleAnswer(option.itemId, option.correct)}
                    disabled={solved || isWrong}
                    accessibilityRole="button"
                    accessibilityLabel={t('daily.challenge.optionLabel', { index: challenge.indexOf(option) + 1 })}
                  >
                    <Image source={image} style={[styles.optionImage, isWrong && styles.optionImageDimmed]} resizeMode="cover" />
                    {isRight ? (
                      <View style={styles.optionCheck}>
                        <Check size={16} color={colors.textPrimary} strokeWidth={3} />
                      </View>
                    ) : null}
                  </AnimatedPressable>
                );
              })}
            </View>
            {solved ? (
              <Text style={[styles.challengeFeedback, styles.challengeFeedbackRight]}>{t('daily.challenge.correct')}</Text>
            ) : wrongIds.length > 0 ? (
              <Text style={styles.challengeFeedback}>{t('daily.challenge.tryAgain')}</Text>
            ) : null}
          </View>
        ) : null}

        {discovery.isCompleted ? (
          <FadeSlideIn style={styles.donePanel}>
            <View style={styles.doneOrnaments}>
              <OymoOrnament size={12} color={colors.accentGold} strokeWidth={1.5} />
              <View style={styles.doneCheck}>
                <Check size={20} color={colors.textPrimary} strokeWidth={3} />
              </View>
              <OymoOrnament size={12} color={colors.accentGold} strokeWidth={1.5} />
            </View>
            <Text style={styles.doneTitle}>{t('daily.done.title')}</Text>
            <Text style={styles.doneText}>{t('daily.done.tomorrow')}</Text>

            <View style={styles.doneActions}>
              <DoneLink label={t('daily.done.readMore')} onPress={() => router.push(`/culture/item/${item.id}` as never)} />
              {experienceRef && experienceRoute ? (
                <DoneLink label={`${t('daily.done.tryIt')}: ${t(experienceRef.titleKey)}`} onPress={() => router.push(experienceRoute as never)} />
              ) : null}
              {relatedGame?.route ? (
                <DoneLink label={`${t('daily.done.play')}: ${t(gameTitleKey(relatedGame.id))}`} onPress={() => router.push(relatedGame.route as never)} />
              ) : null}
            </View>
          </FadeSlideIn>
        ) : (
          <View style={styles.completeWrap}>
            <Button label={t('daily.complete')} onPress={handleComplete} disabled={!canComplete} loading={completing} />
            {!canComplete ? <Text style={styles.completeHint}>{t('daily.completeHint')}</Text> : null}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function DoneLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <AnimatedPressable style={styles.doneLink} onPress={onPress} hoverEffect accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.doneLinkText} numberOfLines={1}>
        {label}
      </Text>
      <ChevronRight size={16} color={colors.accentGold} strokeWidth={2.25} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  content: {
    gap: spacing.md,
  },
  hero: {
    width: '100%',
    aspectRatio: 4 / 3.4,
    backgroundColor: colors.surfaceAlt,
  },
  heroImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  heroText: {
    gap: spacing.xxs,
  },
  overlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  overline: {
    ...typography.overline,
    color: colors.accentGold,
  },
  heroTitle: {
    ...typography.display,
    fontSize: 30,
    color: colors.textOnDark,
  },
  body: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  block: {
    gap: spacing.xxs,
  },
  blockLabel: {
    ...typography.overline,
    color: colors.accentTerracotta,
  },
  blockText: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 23,
  },
  blockTextEditorial: {
    fontFamily: fontFamily.wordmark,
    fontSize: 16,
    lineHeight: 25,
  },
  blockTextChild: {
    fontSize: 17,
    lineHeight: 26,
  },
  challenge: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  challengeQuestion: {
    ...typography.h2,
    color: colors.textPrimary,
    flex: 1,
  },
  challengeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  option: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceAlt,
  },
  optionWrong: {
    borderColor: colors.danger,
  },
  optionRight: {
    borderColor: colors.accentGold,
  },
  optionImage: {
    width: '100%',
    height: '100%',
  },
  optionImageDimmed: {
    opacity: 0.4,
  },
  optionCheck: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeFeedback: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  challengeFeedbackRight: {
    color: colors.primary,
    fontWeight: '700',
  },
  completeWrap: {
    gap: spacing.xs,
    alignItems: 'stretch',
  },
  completeHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  donePanel: {
    backgroundColor: colors.surfaceFeature,
    borderRadius: radii.xxl,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  doneOrnaments: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  doneCheck: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: {
    ...typography.h1,
    color: colors.textOnDark,
    textAlign: 'center',
  },
  doneText: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  doneActions: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
  doneLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.18)',
  },
  doneLinkText: {
    ...typography.bodyBold,
    color: colors.textOnDark,
    flex: 1,
  },
});
