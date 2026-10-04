import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Pin, PinOff, Share2 } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import type { ShareCardContent } from '@/components/share/ShareCard';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import type { AgeExperience } from '@/services/ageExperience/types';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { track } from '@/services/analytics/analytics';
import { useShareCard } from '@/services/share/useShareCard';
import { ownerPins, useAchievementShowcaseStore } from '@/store/useAchievementShowcaseStore';
import { useProgressStore } from '@/store/useProgressStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { profileAchievements } from '../data';
import type { ProfileAchievement } from '../types';
import { MAX_PINS, movePin, pin, unpin, visiblePins } from './showcaseModel';

const CATALOG_IDS = profileAchievements.map((achievement) => achievement.id);
const byId = (id: string) => profileAchievements.find((achievement) => achievement.id === id)!;

/** The current owner's showcase, validated against what they've really earned. */
export function useShowcase() {
  const owner = useRecordsOwner();
  const stored = ownerPins(useAchievementShowcaseStore((state) => state.saved), owner);
  const earnedIds = useProgressStore((state) => state.unlockedAchievementIds) as string[];
  const progressLoaded = useProgressStore((state) => state.isLoaded);
  useEffect(() => {
    void useAchievementShowcaseStore.getState().load();
  }, []);
  const pins = visiblePins(stored, earnedIds, CATALOG_IDS);
  // Prune ids that vanished / are no longer earned - only once progress is known.
  useEffect(() => {
    if (progressLoaded && pins.length !== stored.length) useAchievementShowcaseStore.getState().setPins(owner, pins);
  }, [progressLoaded, pins, stored.length, owner]);
  const setPins = (next: string[]) => useAchievementShowcaseStore.getState().setPins(owner, next);
  return {
    pins,
    earnedIds: earnedIds.filter((id) => CATALOG_IDS.includes(id)),
    pin: (id: string) => {
      const next = pin(pins, id, earnedIds);
      if (next.length !== pins.length) track('achievement_pinned', { achievement_id: id });
      setPins(next);
    },
    unpin: (id: string) => {
      track('achievement_unpinned', { achievement_id: id });
      setPins(unpin(pins, id));
    },
    move: (id: string, delta: -1 | 1) => setPins(movePin(pins, id, delta)),
  };
}

const BADGE: Record<AgeExperience, number> = { child: 84, preteen: 72, teen: 60, adult: 48 };

/** Profile: compact showcase of up to 3 pins (never a trophy wall). */
export function AchievementShowcaseSection() {
  const { t } = useTranslation();
  const { experience } = useAgeExperience();
  const { pins, earnedIds } = useShowcase();
  // Nothing earned yet: the existing achievements card handles discovery.
  if (earnedIds.length === 0) return null;
  const size = BADGE[experience];
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.kicker} accessibilityRole="header">
          {t('showcase.title')}
        </Text>
        <Button label={pins.length === 0 ? t('showcase.choose') : t('showcase.edit')} variant="text" onPress={() => router.push('/profile/achievements/showcase' as never)} />
      </View>
      {pins.length > 0 ? (
        <View style={[styles.row, experience === 'adult' && styles.rowCompact]}>
          {pins.map((id, index) => {
            const achievement = byId(id);
            return (
              <AnimatedPressable key={id} style={styles.badge} onPress={() => router.push('/achievements' as never)} accessibilityRole="button" accessibilityLabel={`${t(achievement.titleKey)}, ${t('showcase.pinned')}, ${t('showcase.position', { index: index + 1, total: pins.length })}`}>
                <Image source={achievement.iconSource} style={{ width: size, height: size }} resizeMode="contain" />
                <Text style={styles.badgeTitle} numberOfLines={2}>
                  {t(achievement.titleKey)}
                </Text>
              </AnimatedPressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function buildShowcaseShareCard(achievements: ProfileAchievement[], titles: string[], label: string): ShareCardContent {
  return {
    title: titles.join(' · '),
    label,
    imageSource: null,
    variant: 'creation',
    artworkSize: { width: 900, height: 420 },
    artwork: (
      <View style={{ width: 900, height: 420, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }}>
        {achievements.map((achievement, index) => (
          <View key={achievement.id} style={{ alignItems: 'center', width: 260, gap: 18 }}>
            <Image source={achievement.iconSource} style={{ width: 220, height: 220 }} resizeMode="contain" />
            <Text style={{ fontSize: 30, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' }} numberOfLines={2}>
              {titles[index]}
            </Text>
          </View>
        ))}
      </View>
    ),
  };
}

/** /profile/achievements/showcase - pin / unpin / reorder earned achievements. */
export function ShowcaseManageScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { pins, earnedIds, pin: pinOne, unpin: unpinOne, move } = useShowcase();
  const { share, shareHost } = useShareCard();
  const earned = profileAchievements.filter((achievement) => earnedIds.includes(achievement.id));

  const onShare = () => {
    const chosen = pins.map(byId);
    track('achievement_showcase_shared');
    void share(buildShowcaseShareCard(chosen, chosen.map((achievement) => t(achievement.titleKey)), t('showcase.shareLabel')), `${t('showcase.shareLabel')}: ${chosen.map((achievement) => t(achievement.titleKey)).join(', ')}`);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header">
          {t('showcase.edit')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Text style={styles.meta} accessibilityLiveRegion="polite">
          {t('showcase.selected', { count: pins.length, max: MAX_PINS })}
        </Text>
        {earned.length === 0 ? <Text style={styles.meta}>{t('showcase.noneEarned')}</Text> : null}

        {pins.length > 0 ? (
          <View style={{ gap: spacing.xs }}>
            <Text style={styles.section}>{t('showcase.pinned')}</Text>
            {pins.map((id, index) => {
              const name = t(byId(id).titleKey);
              return (
                <View key={id} style={styles.item} accessible={false}>
                  <Image source={byId(id).iconSource} style={styles.thumb} resizeMode="contain" />
                  <Text style={[styles.itemTitle, { flex: 1 }]} accessibilityLabel={`${name}, ${t('showcase.pinned')}, ${t('showcase.position', { index: index + 1, total: pins.length })}`}>
                    {index + 1}. {name}
                  </Text>
                  <IconButton icon={ChevronLeft} size={36} iconSize={16} elevated={false} disabled={index === 0} accessibilityLabel={t('showcase.moveLeftLabel', { name })} onPress={() => move(id, -1)} />
                  <IconButton icon={ChevronRight} size={36} iconSize={16} elevated={false} disabled={index === pins.length - 1} accessibilityLabel={t('showcase.moveRightLabel', { name })} onPress={() => move(id, 1)} />
                </View>
              );
            })}
          </View>
        ) : null}

        <Text style={styles.section}>{t('showcase.earned')}</Text>
        {earned.map((achievement) => {
          const pinned = pins.includes(achievement.id);
          const full = !pinned && pins.length >= MAX_PINS;
          const name = t(achievement.titleKey);
          return (
            <View key={achievement.id} style={styles.item}>
              <Image source={achievement.iconSource} style={styles.thumb} resizeMode="contain" />
              <Text style={[styles.itemTitle, { flex: 1 }]}>{name}</Text>
              <Button
                label={pinned ? t('showcase.unpin') : t('showcase.pin')}
                variant={pinned ? 'secondary' : 'primary'}
                size="sm"
                disabled={full}
                icon={pinned ? <PinOff size={14} color={colors.primary} strokeWidth={2} /> : <Pin size={14} color={colors.textOnPrimary} strokeWidth={2} />}
                accessibilityHint={`${name}. ${pinned ? t('showcase.pinned') : full ? t('showcase.full') : ''}`}
                onPress={() => (pinned ? unpinOne(achievement.id) : pinOne(achievement.id))}
              />
            </View>
          );
        })}
        {pins.length > 0 ? <Button label={t('showcase.share')} variant="secondary" icon={<Share2 size={16} color={colors.primary} strokeWidth={2} />} onPress={onShare} /> : null}
      </ScrollView>
      {shareHost}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  card: { gap: spacing.xs, marginTop: spacing.sm, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { ...typography.overline, color: colors.accentTerracotta },
  row: { flexDirection: 'row', justifyContent: 'space-around', gap: spacing.sm },
  rowCompact: { justifyContent: 'flex-start' },
  badge: { alignItems: 'center', gap: 4, flex: 1, maxWidth: 120 },
  badgeTitle: { ...textStyles.small, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  thumb: { width: 40, height: 40 },
  itemTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
});
