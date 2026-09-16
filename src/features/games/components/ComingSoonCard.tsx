import { Lock } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { colors, radii, spacing, typography } from '@/theme';

/** Matches GameCard's own image+text-below rhythm (square artwork area,
 * plain text block underneath) instead of one solid dark tile, so it
 * reads as "one more card in the grid" rather than a visually distinct
 * database-style placeholder. */
export function ComingSoonCard() {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        <Lock size={26} color={colors.textOnDark} strokeWidth={1.75} />
        <OymoOrnament size={14} color="rgba(255,255,255,0.35)" strokeWidth={1.5} />
      </View>
      <View style={styles.textBlock}>
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
    width: '47%',
    gap: spacing.xs,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryPressed,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  textBlock: {
    gap: 1,
  },
  title: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.small,
    color: colors.textMuted,
  },
});
