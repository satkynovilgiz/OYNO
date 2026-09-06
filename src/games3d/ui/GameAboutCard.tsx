import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { colors, radii, spacing, typography } from '@/theme';

type GameAboutCardProps = {
  visible: boolean;
  title: string;
  description: string;
  objective: string;
  onDone: () => void;
};

/** First-time "what is this game?" beat (Section 18/19) - shown once
 * before the interactive controls tutorial, not a wall of text: just the
 * game's name, a one/two-sentence cultural description, and the objective
 * in one line each. Skippable like everything else in the intro flow. */
export function GameAboutCard({ visible, title, description, objective, onDone }: GameAboutCardProps) {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <View style={styles.root}>
      <LinearGradient colors={['rgba(20,14,8,0.92)', 'rgba(20,14,8,0.75)']} style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>

        <View style={styles.objectiveRow}>
          <Text style={styles.objectiveLabel}>{t('games3d.about.objectiveLabel')}</Text>
          <Text style={styles.objectiveText}>{objective}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={onDone}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('gameIntro.skip')}
          style={styles.skipButton}
        >
          <Text style={styles.skipLabel}>{t('gameIntro.skip')}</Text>
        </Pressable>
        <Button label={t('games3d.about.continue')} onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 30,
    justifyContent: 'flex-end',
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    maxHeight: '70%',
    justifyContent: 'flex-end',
  },
  title: {
    ...typography.h1,
    color: colors.textOnDark,
  },
  description: {
    ...typography.body,
    color: 'rgba(255,255,255,0.85)',
  },
  objectiveRow: {
    marginTop: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: 2,
  },
  objectiveLabel: {
    ...typography.overline,
    color: colors.accentGold,
  },
  objectiveText: {
    ...typography.bodyBold,
    color: colors.textOnDark,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  skipButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  skipLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '700',
  },
});
