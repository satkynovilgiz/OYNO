import { Check } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { colors, radii, shadows, spacing, typography } from '@/theme';

type LanguageOption = { id: SupportedLanguage; label: string; flag: string };

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { id: 'kg', label: 'Кыргызча', flag: '🇰🇬' },
  { id: 'ru', label: 'Русский', flag: '🇷🇺' },
  { id: 'en', label: 'English', flag: '🇺🇸' },
];

type LanguageSelectScreenProps = {
  selected: SupportedLanguage;
  onSelect: (language: SupportedLanguage) => void;
  onContinue: () => void;
};

/** First-launch language picker (spec Section 14) - distinct from the
 * language switcher that will live in Settings, though both just call
 * useAppStore.setLanguage under the hood. */
export function LanguageSelectScreen({ selected, onSelect, onContinue }: LanguageSelectScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={[styles.content, { paddingTop: insets.top + spacing.xxl }]}>
        <Text style={styles.title}>Тилди тандаңыз</Text>

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
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button label="Улантуу" onPress={onContinue} />
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
  title: {
    ...typography.display,
    color: colors.textPrimary,
    textAlign: 'center',
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
    borderColor: 'transparent',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...shadows.card,
  },
  optionSelected: {
    borderColor: colors.primary,
  },
  flag: {
    fontSize: 28,
  },
  optionLabel: {
    ...typography.h1,
    color: colors.textPrimary,
    flex: 1,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
});
