import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Check, ChevronLeft, Coins, Gift, Lock, Sparkles } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, Button, EmptyState, IconButton, ProgressBar, Rail, SectionHeader, useRailItemWidth } from '@/components/ui';
import { showToast } from '@/components/ui/Toast';
import type { SupportedLanguage } from '@/i18n';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { formatShortDate } from '@/services/i18n/formatDate';
import { localDateKey } from '@/services/daily/dailyDiscovery';
import { xpProgress } from '@/services/progress/levelConfig';
import { useShareCard } from '@/services/share/useShareCard';
import { useActivityStore } from '@/store/useActivityStore';
import { DAILY_GIFT_REWARD, useProgressStore } from '@/store/useProgressStore';
import { cardRadii, colors, editorial, radii, spacing, textStyles } from '@/theme';

import { buildAchievementsView, type AchievementCard } from './achievementsModel';
import { AchievementDetailSheet } from './components';

type AchievementsScreenProps = {
  unlockedIds: string[];
  onPressBack: () => void;
};

/**
 * Achievements & rewards - a calm collection, not a points dashboard:
 *   summary     real earned / total, Level + XP to next, coin balance
 *   daily gift  the real reward values, claimable once a day
 *   recent      earned achievements, newest real date first
 *   categories  Explore / Culture / Games, earned before locked, a quiet
 *               "Collection complete" only when every one is earned
 * Tap -> a compact sheet with the real requirement and one action.
 * No ranks, rarity, streak pressure or invented rewards (only XP and coins
 * exist in the economy).
 */
export function AchievementsScreen({ unlockedIds, onPressBack }: AchievementsScreenProps) {
  useTrackScreenView('achievements');
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { experience } = useAgeExperience();
  const events = useActivityStore((state) => state.events);
  const xp = useProgressStore((state) => state.xp);
  const coins = useProgressStore((state) => state.coins);
  const giftClaimedDate = useProgressStore((state) => state.dailyGiftClaimedDateISO);
  const [selected, setSelected] = useState<AchievementCard | null>(null);
  const [claiming, setClaiming] = useState(false);
  const { share, shareHost } = useShareCard();

  useEffect(() => {
    if (!useActivityStore.getState().isLoaded) void useActivityStore.getState().load();
  }, []);

  const view = useMemo(() => buildAchievementsView(unlockedIds, events), [unlockedIds, events]);
  const { level, xpCurrent, xpMax } = xpProgress(xp);
  const giftClaimed = giftClaimedDate === new Date().toISOString().slice(0, 10);
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';
  const recentWidth = useRailItemWidth('compact', isChild ? 0.6 : 0.5);
  // Two columns everywhere: long RU/KG titles ("Путешественник") never break mid-word.
  const columns = 2;
  const cellWidth = Math.floor((Math.min(width, 520) - spacing.md * 2 - spacing.sm * (columns - 1)) / columns);

  async function claimGift() {
    if (claiming || giftClaimed) return;
    setClaiming(true);
    const ok = await useProgressStore.getState().claimDailyGift();
    setClaiming(false);
    if (ok) {
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast(t('profile.achievements.v2.giftToast', DAILY_GIFT_REWARD));
    }
  }

  function shareCard(card: AchievementCard) {
    setSelected(null);
    void share(
      { title: t(card.titleKey), label: t('profile.achievements.v2.shareLabel'), imageSource: card.iconSource, variant: 'badge', completedLabel: t('profile.achievements.v2.earnedBy', { requirement: t(card.requirementKey) }) },
      `${t('profile.achievements.v2.shareLabel')}: ${t(card.titleKey)}`,
    );
  }

  function a11yFor(card: AchievementCard): string {
    const requirement = t(card.requirementKey);
    return card.earned ? t('profile.achievements.v2.earnedA11y', { title: t(card.titleKey), requirement }) : t('profile.achievements.v2.lockedA11y', { title: t(card.titleKey), requirement });
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xs, paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <IconButton icon={ChevronLeft} size={40} iconSize={20} shape="roundedSquare" elevated={false} accessibilityLabel={t('common.back')} onPress={onPressBack} />
        </View>

        {/* Summary: real earned/total, Level + XP to next, coins. */}
        <View style={styles.summary}>
          <View style={styles.summaryTop}>
            <View style={styles.seal} accessibilityElementsHidden>
              <OymoOrnament size={18} color={colors.accentGold} strokeWidth={1.5} />
              <Text style={styles.sealLevel}>{level}</Text>
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryEyebrow}>{t('profile.achievements.title')}</Text>
              <Text style={[styles.summaryCount, !isChild && styles.summaryCountEditorial]} accessibilityRole="header">
                {t('profile.achievements.unlocked', { unlocked: view.earnedCount, total: view.total })}
              </Text>
              <Text style={styles.summaryRank}>
                {t('profile.achievements.v2.levelTitle', { level })} · {t('profile.rankTitle')}
              </Text>
            </View>
          </View>
          <View style={styles.xp} accessible accessibilityLabel={`${t('profile.achievements.v2.levelTitle', { level })}. ${t('profile.achievements.v2.xpToNext', { current: xpCurrent, max: xpMax })}`}>
            <ProgressBar progress={xpMax > 0 ? xpCurrent / xpMax : 0} height={5} fillColor={colors.accentGold} trackColor="rgba(251,243,227,0.18)" />
            <View style={styles.xpRow}>
              <Text style={styles.xpText}>{t('profile.achievements.v2.xpToNext', { current: xpCurrent, max: xpMax })}</Text>
              <View style={styles.coins} accessible accessibilityLabel={`${coins} ${t('profile.achievements.v2.coins')}`}>
                <Coins size={14} color={colors.accentGold} strokeWidth={2.25} />
                <Text style={styles.coinsText}>{coins.toLocaleString('ru-RU')}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Daily gift - real values, claimable once a day, no countdown. */}
        <View style={[styles.gift, !giftClaimed && styles.giftReady]}>
          <View style={[styles.giftIcon, !giftClaimed && styles.giftIconReady]}>
            {giftClaimed ? <Check size={18} color={colors.primary} strokeWidth={2.5} /> : <Gift size={18} color={colors.textPrimary} strokeWidth={2.25} />}
          </View>
          <View style={styles.giftText}>
            <Text style={styles.giftTitle}>{t('profile.achievements.v2.giftTitle')}</Text>
            <Text style={styles.giftBody}>{giftClaimed ? t('profile.achievements.v2.giftClaimed') : t('profile.achievements.v2.giftReady', DAILY_GIFT_REWARD)}</Text>
          </View>
          {giftClaimed ? null : <Button label={t('profile.achievements.v2.giftClaim')} variant="accent" size="sm" loading={claiming} onPress={() => void claimGift()} />}
        </View>

        {view.earnedCount === 0 ? (
          <View style={styles.empty}>
            <EmptyState icon={Sparkles} title={t('profile.achievements.v2.emptyTitle')} description={t('profile.achievements.v2.emptyBody')} />
            <View style={styles.center}>
              <Button label={t('profile.achievements.v2.explore')} variant="secondary" onPress={() => router.push('/explore' as never)} />
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <SectionHeader title={t('profile.achievements.v2.recentTitle')} size="sm" inset={0} />
            <View style={styles.bleed}>
              <Rail itemWidth={recentWidth}>
                {view.recent.map((card) => (
                  <AnimatedPressable key={card.id} style={[styles.recentCard, { width: recentWidth }]} onPress={() => setSelected(card)} press="soft" haptic="light" accessibilityRole="button" accessibilityLabel={a11yFor(card)}>
                    <View style={styles.recentHalo}>
                      <Image source={card.iconSource} style={styles.recentBadge} resizeMode="contain" />
                    </View>
                    <Text style={styles.recentTitle} numberOfLines={2}>
                      {t(card.titleKey)}
                    </Text>
                    {card.earnedAt ? <Text style={styles.recentDate}>{formatShortDate(localDateKey(new Date(card.earnedAt)), language)}</Text> : null}
                  </AnimatedPressable>
                ))}
              </Rail>
            </View>
          </View>
        )}

        {view.groups.map((group) => (
          <View key={group.id} style={styles.section}>
            <View style={styles.groupHead}>
              <SectionHeader title={t(`profile.achievements.v2.categories.${group.id}`)} size="sm" inset={0} editorialTitle={isAdult} />
              {group.complete ? (
                <View style={styles.complete}>
                  <Check size={12} color={colors.textPrimary} strokeWidth={3} />
                  <Text style={styles.completeText}>{t('profile.achievements.v2.categoryComplete')}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.grid}>
              {group.cards.map((card) => (
                <AnimatedPressable key={card.id} style={[styles.cell, { width: cellWidth }, card.earned && styles.cellEarned]} onPress={() => setSelected(card)} press="soft" accessibilityRole="button" accessibilityLabel={a11yFor(card)}>
                  <View style={styles.cellBadge}>
                    <Image source={card.iconSource} style={[styles.cellImage, !card.earned && styles.cellImageLocked]} resizeMode="contain" />
                    <View style={[styles.stateMark, card.earned ? styles.stateEarned : styles.stateLocked]}>
                      {card.earned ? <Check size={11} color={colors.textPrimary} strokeWidth={3} /> : <Lock size={10} color={colors.textOnDark} strokeWidth={2.5} />}
                    </View>
                  </View>
                  <Text style={[styles.cellTitle, !card.earned && styles.cellTitleLocked]} numberOfLines={2}>
                    {t(card.titleKey)}
                  </Text>
                  {!card.earned && !isChild ? (
                    <Text style={styles.cellHint} numberOfLines={3}>
                      {t(card.requirementKey)}
                    </Text>
                  ) : null}
                </AnimatedPressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <AchievementDetailSheet card={selected} onClose={() => setSelected(null)} onShare={shareCard} />
      {shareHost}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.md, gap: spacing.lg },
  topRow: { flexDirection: 'row' },
  summary: { padding: spacing.md, gap: spacing.md, borderRadius: cardRadii.hero, backgroundColor: colors.surfaceFeature },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  seal: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.accentGold, backgroundColor: 'rgba(232,185,61,0.1)' },
  sealLevel: { ...editorial(textStyles.h2), color: colors.textOnDark, marginTop: -2 },
  summaryText: { flex: 1, gap: 2 },
  summaryEyebrow: { ...textStyles.overline, color: colors.accentGold },
  summaryCount: { ...textStyles.h2, color: colors.textOnDark },
  summaryCountEditorial: { ...editorial(textStyles.h2) },
  summaryRank: { ...textStyles.caption, color: colors.textOnDarkSecondary },
  xp: { gap: 6 },
  xpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  xpText: { ...textStyles.small, color: colors.textOnDarkSecondary, flexShrink: 1 },
  coins: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  coinsText: { ...textStyles.caption, fontWeight: '700', color: colors.textOnDark },
  gift: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  giftReady: { borderWidth: 1.5, borderColor: colors.accentGold },
  giftIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  giftIconReady: { backgroundColor: colors.accentGold },
  giftText: { flex: 1, gap: 2 },
  giftTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  giftBody: { ...textStyles.caption, color: colors.textSecondary },
  empty: { gap: spacing.sm },
  center: { alignItems: 'center' },
  section: { gap: spacing.sm },
  bleed: { marginHorizontal: -spacing.md },
  recentCard: { alignItems: 'center', gap: 6, padding: spacing.md, borderRadius: cardRadii.media, backgroundColor: colors.surfaceElevated },
  recentHalo: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(232,185,61,0.16)' },
  recentBadge: { width: 86, height: 86 },
  recentTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  recentDate: { ...textStyles.small, color: colors.textMuted },
  groupHead: { gap: 4 },
  complete: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: spacing.xs, paddingVertical: 3, borderRadius: radii.pill, backgroundColor: colors.accentGold },
  completeText: { ...textStyles.small, color: colors.textPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { alignItems: 'center', gap: 4, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  cellEarned: { backgroundColor: 'rgba(232,185,61,0.12)' },
  cellBadge: { width: '64%', aspectRatio: 1 },
  cellImage: { width: '100%', height: '100%' },
  cellImageLocked: { opacity: 0.55 },
  stateMark: { position: 'absolute', right: 0, bottom: 0, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surfaceElevated },
  stateEarned: { backgroundColor: colors.accentGold },
  stateLocked: { backgroundColor: 'rgba(19,32,24,0.8)' },
  cellTitle: { ...textStyles.caption, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  cellTitleLocked: { color: colors.textSecondary },
  cellHint: { ...textStyles.small, fontWeight: '500', color: colors.textMuted, textAlign: 'center' },
});
