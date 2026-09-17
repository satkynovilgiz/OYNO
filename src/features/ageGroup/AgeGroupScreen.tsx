import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, Button, FadeSlideIn } from '@/components/ui';
import type { AgeGroup } from '@/services/ageExperience/types';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import { AGE_GROUP_OPTIONS } from './ageGroupOptions';

type AgeGroupScreenProps = {
  initialSelected: AgeGroup | null;
  onContinue: (ageGroup: AgeGroup) => void;
};

/** Onboarding age-group step (spec "Add age-group selection to OYNO
 * onboarding") - asks for a self-selected band, never a date of birth, so
 * OYNO never stores or reasons about an exact age. Reused (selection-only,
 * no "continue" gate) by Settings > Experience to change the group later. */
export function AgeGroupScreen({ initialSelected, onContinue }: AgeGroupScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<AgeGroup | null>(initialSelected);

  return (
    <View style={styles.root}>
      <View style={[styles.content, { paddingTop: insets.top + spacing.xl }]}>
        <View style={styles.ornamentRow}>
          <OymoOrnament size={12} color={colors.accentGold} />
          <OymoOrnament size={14} color={colors.accentGold} />
          <OymoOrnament size={12} color={colors.accentGold} />
        </View>

        <View style={styles.heading}>
          <Text style={styles.title}>{t('ageGroup.title')}</Text>
          <Text style={styles.subtitle}>{t('ageGroup.subtitle')}</Text>
        </View>

        <View style={styles.grid}>
          {AGE_GROUP_OPTIONS.map((option, optionIndex) => {
            const isSelected = option.id === selected;
            const Icon = option.icon;
            return (
              <FadeSlideIn key={option.id} index={optionIndex} style={styles.cardWrapper}>
                <AnimatedPressable
                  onPress={() => setSelected(option.id)}
                  hoverEffect
                  haptic="light"
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={t(option.labelKey)}
                  style={[styles.card, isSelected && styles.cardSelected]}
                >
                  <View style={[styles.iconCircle, isSelected && styles.iconCircleSelected]}>
                    <Icon size={30} color={isSelected ? colors.textOnPrimary : colors.primary} strokeWidth={1.75} />
                  </View>
                  <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>{t(option.labelKey)}</Text>
                  {isSelected ? (
                    <View style={styles.checkBadge}>
                      <Check size={13} color={colors.textOnPrimary} strokeWidth={3} />
                    </View>
                  ) : null}
                </AnimatedPressable>
              </FadeSlideIn>
            );
          })}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label={t('ageGroup.continue')}
          disabled={!selected}
          onPress={() => {
            if (selected) onContinue(selected);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
  },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },
  ornamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  heading: {
    gap: spacing.xxs,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  cardWrapper: {
    width: '47%',
  },
  card: {
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    ...shadows.card,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceWarm,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleSelected: {
    backgroundColor: colors.primary,
  },
  cardLabel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  cardLabelSelected: {
    color: colors.primary,
  },
  checkBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
});
