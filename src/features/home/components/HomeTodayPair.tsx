import { Calendar, Check, Coins, Gift, Star, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AnimatedPressable, ProgressBar, SectionHeader } from '@/components/ui';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

import type { DailyChallenge, DailyGift } from '../types';

/** Below this window width the two cards stack instead of squeezing. */
const STACK_BELOW = 360;

/**
 * "Today" - the daily task and the daily gift as ONE compact family: same
 * height, radius, padding, icon medallion and title size. Ready-to-claim
 * reads the same on both (gold edge + gold medallion), so the gift is
 * never louder than the task. Logic unchanged - callers pass the actions.
 */
export function HomeTodayPair({
  challenge,
  challengeReady,
  onPressChallenge,
  gift,
  giftClaimed,
  onPressGift,
}: {
  challenge: DailyChallenge;
  challengeReady: boolean;
  onPressChallenge: () => void;
  gift: DailyGift;
  giftClaimed: boolean;
  onPressGift: () => void;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const ratio = challenge.progressMax > 0 ? challenge.progressCurrent / challenge.progressMax : 0;

  return (
    <View style={styles.section}>
      <SectionHeader title={t('home.sections.today')} />
      <View style={[styles.row, width < STACK_BELOW && styles.stack]}>
        <TodayCard
          icon={Calendar}
          title={t('home.dailyChallenge.title')}
          body={challenge.description}
          ready={challengeReady}
          onPress={onPressChallenge}
          accessibilityLabel={`${t('home.dailyChallenge.title')}. ${challenge.description}. ${challenge.progressCurrent} / ${challenge.progressMax}`}
        >
          <View style={styles.progressRow}>
            <ProgressBar progress={ratio} height={4} trackColor={colors.surfaceMuted} style={styles.bar} />
            <Text style={styles.count}>
              {challenge.progressCurrent}/{challenge.progressMax}
            </Text>
          </View>
          <View style={styles.rewardRow}>
            <Star size={13} color={colors.accentGoldPressed} strokeWidth={2.25} />
            <Text style={styles.reward}>{challenge.rewardXp}</Text>
            <Coins size={13} color={colors.accentGoldPressed} strokeWidth={2.25} />
            <Text style={styles.reward}>{challenge.rewardCoins}</Text>
          </View>
        </TodayCard>

        <TodayCard
          icon={giftClaimed ? Check : Gift}
          title={t('home.dailyGift.title')}
          body={gift.subtitle}
          ready={!giftClaimed}
          onPress={giftClaimed ? undefined : onPressGift}
          accessibilityLabel={`${t('home.dailyGift.title')}. ${gift.subtitle}`}
        />
      </View>
    </View>
  );
}

function TodayCard({
  icon: Icon,
  title,
  body,
  ready,
  onPress,
  accessibilityLabel,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  ready: boolean;
  onPress?: () => void;
  accessibilityLabel: string;
  children?: ReactNode;
}) {
  return (
    <AnimatedPressable
      style={[styles.card, ready && styles.cardReady]}
      onPress={onPress}
      disabled={!onPress}
      press="soft"
      haptic={onPress ? 'light' : false}
      accessibilityRole="button"
      accessibilityState={{ disabled: !onPress }}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.medallion, ready && styles.medallionReady]}>
        <Icon size={18} color={ready ? colors.textPrimary : colors.primary} strokeWidth={2.25} />
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.body} numberOfLines={3}>
        {body}
      </Text>
      {children ? <View style={styles.footer}>{children}</View> : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md },
  stack: { flexDirection: 'column' },
  card: { flex: 1, minHeight: 156, padding: spacing.md, gap: 4, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: 'transparent' },
  cardReady: { borderColor: colors.accentGold },
  medallion: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted, marginBottom: 4 },
  medallionReady: { backgroundColor: colors.accentGold },
  title: { ...textStyles.title, fontSize: 16, lineHeight: 21, color: colors.textPrimary },
  body: { ...textStyles.caption, color: colors.textSecondary },
  footer: { marginTop: 'auto', gap: 4, paddingTop: spacing.xs },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bar: { flex: 1 },
  count: { ...textStyles.small, color: colors.textSecondary },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  reward: { ...textStyles.small, color: colors.textSecondary, marginRight: 8 },
});
