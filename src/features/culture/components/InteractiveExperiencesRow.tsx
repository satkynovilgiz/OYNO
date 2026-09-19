import { Play } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, type ImageSourcePropType } from 'react-native';

import { FadeSlideIn, InteractiveCard } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

export type InteractiveExperience = {
  id: string;
  titleKey: string;
  imageSource: ImageSourcePropType;
};

type InteractiveExperiencesRowProps = {
  experiences: InteractiveExperience[];
  onPressExperience: (id: string) => void;
};

/** "Өзүң жасап көр" - real interactive modules only. A tile is only ever
 * added here once its module actually exists and opens something - a tile
 * leading nowhere would be exactly the kind of dead button the task
 * explicitly calls out. Built on the shared INTERACTIVE CARD family
 * (Section "Create a NEW modern OYNO card system") instead of its own
 * one-off tile styling. */
export function InteractiveExperiencesRow({ experiences, onPressExperience }: InteractiveExperiencesRowProps) {
  const { t } = useTranslation();

  if (experiences.length === 0) return null;

  return (
    <FadeSlideIn style={styles.section}>
      <Text style={styles.sectionTitle}>{t('culture.interactive.title')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {experiences.map((experience) => (
          <InteractiveCard
            key={experience.id}
            imageSource={experience.imageSource}
            title={t(experience.titleKey)}
            ctaIcon={Play}
            onPress={() => onPressExperience(experience.id)}
          />
        ))}
      </ScrollView>
    </FadeSlideIn>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h1,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
});
