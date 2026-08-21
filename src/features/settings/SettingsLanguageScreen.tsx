import { Check } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import { SettingsScreenLayout } from './components/SettingsScreenLayout';

type LanguageOption = { id: SupportedLanguage; label: string; flag: string };

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { id: 'kg', label: 'Кыргызча', flag: '🇰🇬' },
  { id: 'ru', label: 'Русский', flag: '🇷🇺' },
  { id: 'en', label: 'English', flag: '🇺🇸' },
];

type SettingsLanguageScreenProps = {
  selected: SupportedLanguage;
  onSelect: (language: SupportedLanguage) => void;
  onPressBack: () => void;
};

/** Settings > Тил (spec Section 56) - unlike the first-launch language
 * picker, selecting here applies immediately, no separate "continue" step. */
export function SettingsLanguageScreen({ selected, onSelect, onPressBack }: SettingsLanguageScreenProps) {
  return (
    <SettingsScreenLayout title="Тил" onPressBack={onPressBack}>
      <View style={styles.list}>
        {LANGUAGE_OPTIONS.map((option) => {
          const isSelected = option.id === selected;
          return (
            <AnimatedPressable
              key={option.id}
              onPress={() => onSelect(option.id)}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              style={[styles.option, isSelected && styles.optionSelected]}
            >
              <Text style={styles.flag}>{option.flag}</Text>
              <Text style={styles.optionLabel}>{option.label}</Text>
              {isSelected ? <Check size={20} color={colors.primary} strokeWidth={2.5} /> : null}
            </AnimatedPressable>
          );
        })}
      </View>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
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
    borderColor: 'transparent',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...shadows.card,
  },
  optionSelected: {
    borderColor: colors.primary,
  },
  flag: {
    fontSize: 24,
  },
  optionLabel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flex: 1,
  },
});
