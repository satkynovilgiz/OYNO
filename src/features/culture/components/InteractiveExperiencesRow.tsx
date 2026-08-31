import { Play } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

export type InteractiveExperience = {
  id: string;
  titleKey: string;
  imageSource: ImageSourcePropType;
};

type InteractiveExperiencesRowProps = {
  experiences: InteractiveExperience[];
  onPressExperience: (id: string) => void;
};

/** "Өзүң жасап көр" - real interactive modules only (Оймо Creator, Boz Үй
 * Builder). Deliberately doesn't list Shyrdak/Komuz tiles since those
 * modules don't exist yet - a tile that opens nothing would be exactly the
 * kind of dead button the task explicitly calls out. */
export function InteractiveExperiencesRow({ experiences, onPressExperience }: InteractiveExperiencesRowProps) {
  const { t } = useTranslation();

  if (experiences.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('culture.interactive.title')}</Text>
      <View style={styles.row}>
        {experiences.map((experience) => (
          <AnimatedPressable
            key={experience.id}
            style={styles.tile}
            onPress={() => onPressExperience(experience.id)}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={t(experience.titleKey)}
          >
            <Image source={experience.imageSource} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <View style={styles.playBadge}>
              <Play size={14} color={colors.textOnPrimary} fill={colors.textOnPrimary} strokeWidth={0} />
            </View>
            <View style={styles.tileFooter}>
              <Text style={styles.tileTitle} numberOfLines={2}>
                {t(experience.titleKey)}
              </Text>
            </View>
          </AnimatedPressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    height: 120,
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surfaceAlt,
    ...shadows.card,
  },
  playBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.xs,
    backgroundColor: colors.overlayEnd,
  },
  tileTitle: {
    ...typography.caption,
    color: colors.textOnDark,
    fontWeight: '700',
  },
});
