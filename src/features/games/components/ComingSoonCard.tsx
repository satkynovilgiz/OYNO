import { Lock } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, spacing, typography } from '@/theme';

const WIDTH_BY_CARD_SCALE = { large: '100%', medium: '47%', compact: '47%', dense: '31%' } as const;
const ASPECT_RATIO_BY_CARD_SCALE = { large: 1.35, medium: 0.92, compact: 0.98, dense: 1.05 };

/** Matches GameCard's own one-complete-visual-object rhythm (full-bleed
 * rounded surface, content anchored at the bottom) instead of a plain
 * image-then-text tile, so it reads as "one more card in the grid"
 * rather than a visually distinct database-style placeholder. Shares
 * GameCard's own width/aspect-ratio scale so it never breaks the grid's
 * column rhythm at any AgeExperience. */
export function ComingSoonCard() {
  const { t } = useTranslation();
  const { config } = useAgeExperience();

  return (
    <View
      style={[
        styles.card,
        {
          width: resolveByCardScale(config.cardScale, WIDTH_BY_CARD_SCALE),
          aspectRatio: resolveByCardScale(config.cardScale, ASPECT_RATIO_BY_CARD_SCALE),
        },
      ]}
    >
      <View style={styles.iconRow}>
        <Lock size={22} color={colors.accentGold} strokeWidth={1.75} />
        <OymoOrnament size={13} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {t('games.comingSoon.title')}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {t('games.comingSoon.subtitle')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    backgroundColor: colors.surfaceFeature,
    borderWidth: 1,
    borderColor: 'rgba(232,185,61,0.25)',
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  content: {
    gap: 2,
  },
  title: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.textOnDark,
  },
  subtitle: {
    ...typography.small,
    color: 'rgba(255,255,255,0.7)',
  },
});
