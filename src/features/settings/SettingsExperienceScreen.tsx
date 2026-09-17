import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { AGE_GROUP_OPTIONS } from '@/features/ageGroup/ageGroupOptions';
import type { AgeGroup } from '@/services/ageExperience/types';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import { SettingsScreenLayout } from './components/SettingsScreenLayout';

type SettingsExperienceScreenProps = {
  selected: AgeGroup;
  onSelect: (ageGroup: AgeGroup) => void;
  onPressBack: () => void;
};

/** Settings > Experience / Жаш режими (spec "Add Age Experience controls to
 * Settings/Profile") - changing the selection here applies immediately
 * (useAgeExperience reads straight from the store), same "no separate
 * continue step" pattern as SettingsLanguageScreen. Never erases progress -
 * this screen only ever writes the ageGroup key. */
export function SettingsExperienceScreen({ selected, onSelect, onPressBack }: SettingsExperienceScreenProps) {
  const { t } = useTranslation();
  return (
    <SettingsScreenLayout title={t('settings.experience.title')} onPressBack={onPressBack}>
      <Text style={styles.description}>{t('settings.experience.description')}</Text>
      <View style={styles.list}>
        {AGE_GROUP_OPTIONS.map((option) => {
          const isSelected = option.id === selected;
          const Icon = option.icon;
          return (
            <AnimatedPressable
              key={option.id}
              onPress={() => onSelect(option.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={t(option.labelKey)}
              style={[styles.option, isSelected && styles.optionSelected]}
            >
              <View style={[styles.iconChip, isSelected && styles.iconChipSelected]}>
                <Icon size={20} color={isSelected ? colors.textOnPrimary : colors.primary} strokeWidth={1.75} />
              </View>
              <Text style={styles.optionLabel}>{t(option.labelKey)}</Text>
              {isSelected ? <Check size={20} color={colors.primary} strokeWidth={2.5} /> : null}
            </AnimatedPressable>
          );
        })}
      </View>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  description: {
    ...typography.caption,
    color: colors.textMuted,
  },
  list: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...shadows.card,
  },
  optionSelected: {
    borderColor: colors.primary,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChipSelected: {
    backgroundColor: colors.primary,
  },
  optionLabel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flex: 1,
  },
});
