import { Gift } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, Card, IconChip } from '@/components/ui';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, spacing, typography } from '@/theme';

import type { DailyGift } from '../types';

type DailyGiftCardProps = {
  gift: DailyGift;
  onPress?: () => void;
  /** Not yet claimed today (Section "daily task/reward cards feel more
   * special") - a gold ring + a warmer icon chip instead of a generic
   * card border, the same "ready" cue as the other 2 daily cards. */
  claimed?: boolean;
};

const ICON_CHIP_SIZE_BY_CARD_SCALE = { large: 56, medium: 40, compact: 36, dense: 32 };
const TITLE_FONT_SIZE_BY_CARD_SCALE = { large: 18, medium: 13, compact: 13, dense: 12 };
const SUBTITLE_FONT_SIZE_BY_CARD_SCALE = { large: 15, medium: 11, compact: 11, dense: 10 };

/** Compact vertical layout so this reads consistently next to
 * DailyChallengeCard when the two sit side by side (Section "reduce
 * dashboard-box feeling" - was a wide horizontal strip that only worked
 * full-width). The whole card is the tap target instead of a separate
 * chevron button. */
export function DailyGiftCard({ gift, onPress, claimed = false }: DailyGiftCardProps) {
  const { t } = useTranslation();
  const { config } = useAgeExperience();
  const ready = !claimed;

  return (
    <Card style={[styles.card, ready && styles.cardReady]} padded={false}>
      <AnimatedPressable
        style={styles.pressable}
        onPress={onPress}
        hoverEffect
        accessibilityRole="button"
        accessibilityLabel={t('home.dailyGift.openLabel')}
      >
        <IconChip
          icon={Gift}
          size={resolveByCardScale(config.cardScale, ICON_CHIP_SIZE_BY_CARD_SCALE)}
          iconSize={resolveByCardScale(config.cardScale, { large: 28, medium: 20, compact: 18, dense: 16 })}
          color={ready ? colors.accentGold : colors.primary}
        />
        <View style={styles.textBlock}>
          <Text style={[styles.title, { fontSize: resolveByCardScale(config.cardScale, TITLE_FONT_SIZE_BY_CARD_SCALE) }]}>
            {t('home.dailyGift.title')}
          </Text>
          <Text
            style={[styles.subtitle, { fontSize: resolveByCardScale(config.cardScale, SUBTITLE_FONT_SIZE_BY_CARD_SCALE) }]}
            numberOfLines={2}
          >
            {gift.subtitle}
          </Text>
        </View>
      </AnimatedPressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  cardReady: {
    borderWidth: 1.5,
    borderColor: colors.accentGold,
  },
  pressable: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  textBlock: {
    gap: 1,
  },
  title: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.small,
    color: colors.textSecondary,
  },
});
