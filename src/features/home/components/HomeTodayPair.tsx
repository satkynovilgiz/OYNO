import { Calendar, Check, Coins, Gift, Star, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, ProgressBar } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

import type { DailyChallenge, DailyGift } from '../types';

import { HOME_RADIUS, HomeSectionHeader } from './homeKit';

/**
 * "Today" - the daily task and the daily gift as ONE visual family: same
 * height, radius, padding, icon medallion and heading size, side by side.
 * Ready-to-claim is shown the same way on both (a gold edge + gold label),
 * so the gift is never louder than the task. Logic is unchanged - the
 * callers pass the existing actions.
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
  const ratio = challenge.progressMax > 0 ? challenge.progressCurrent / challenge.progressMax : 0;

  return (
    <View style={styles.section}>
      <HomeSectionHeader title={t('home.sections.today')} />
      <View style={styles.row}>
        <TodayCard
          icon={Calendar}
          title={t('home.dailyChallenge.title')}
          body={challenge.description}
          ready={challengeReady}
          onPress={onPressChallenge}
          accessibilityLabel={`${t('home.dailyChallenge.title')}. ${challenge.description}. ${challenge.progressCurrent} / ${challenge.progressMax}`}
        >
          <View style={styles.progressRow}>
            <ProgressBar progress={ratio} height={5} style={styles.bar} />
            <Text style={styles.count}>
              {challenge.progressCurrent}/{challenge.progressMax}
            </Text>
          </View>
          <View style={styles.rewardRow}>
            <Star size={15} color={colors.accentGoldPressed} strokeWidth={2.25} />
            <Text style={styles.reward}>{challenge.rewardXp}</Text>
            <Coins size={15} color={colors.accentGoldPressed} strokeWidth={2.25} />
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
      pressScale={0.97}
      haptic={onPress ? 'light' : false}
      accessibilityRole="button"
      accessibilityState={{ disabled: !onPress }}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.medallion, ready && styles.medallionReady]}>
        <Icon size={22} color={ready ? colors.textPrimary : colors.primary} strokeWidth={2.25} />
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.body} numberOfLines={2}>
        {body}
      </Text>
      {children ? <View style={styles.footer}>{children}</View> : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md },
  card: { flex: 1, minHeight: 210, padding: spacing.md, gap: 6, borderRadius: HOME_RADIUS.standard, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: 'transparent' },
  cardReady: { borderColor: colors.accentGold },
  medallion: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt, marginBottom: 4 },
  medallionReady: { backgroundColor: colors.accentGold },
  title: { ...typography.h2, fontSize: 18, lineHeight: 23, color: colors.textPrimary },
  body: { ...typography.caption, fontSize: 14, lineHeight: 19, color: colors.textSecondary },
  footer: { marginTop: 'auto', gap: 4, paddingTop: spacing.xs },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bar: { flex: 1 },
  count: { ...typography.caption, fontWeight: '700', color: colors.textSecondary },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  reward: { ...typography.caption, fontWeight: '700', color: colors.textSecondary, marginRight: 8 },
});
