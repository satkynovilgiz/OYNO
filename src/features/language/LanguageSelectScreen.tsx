import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, Button, FadeSlideIn } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import wordmark from '@assets/img/OYNO_design/wordmark.png';

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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={[styles.content, { paddingTop: insets.top + spacing.xl }]}>
        <View style={styles.brand}>
          <Image source={wordmark} style={styles.wordmark} resizeMode="contain" />
          <View style={styles.ornamentRow}>
            <OymoOrnament size={12} color={colors.accentGold} />
            <OymoOrnament size={14} color={colors.accentGold} />
            <OymoOrnament size={12} color={colors.accentGold} />
          </View>
        </View>

        <View style={styles.heading}>
          <Text style={styles.title}>{t('language.title')}</Text>
          <Text style={styles.subtitle}>{t('language.subtitle')}</Text>
        </View>

        <View style={styles.list}>
          {LANGUAGE_OPTIONS.map((option, optionIndex) => {
            const isSelected = option.id === selected;
            return (
              <FadeSlideIn key={option.id} index={optionIndex}>
                <AnimatedPressable
                  onPress={() => onSelect(option.id)}
                  hoverEffect
                  haptic="light"
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={option.label}
                  style={[styles.option, isSelected && styles.optionSelected]}
                >
                  <View style={styles.flagChip}>
                    <Text style={styles.flag}>{option.flag}</Text>
                  </View>
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>{option.label}</Text>
                  {isSelected ? (
                    <View style={styles.checkBadge}>
                      <Check size={14} color={colors.textOnPrimary} strokeWidth={3} />
                    </View>
                  ) : null}
                </AnimatedPressable>
              </FadeSlideIn>
            );
          })}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button label={t('language.continue')} onPress={onContinue} />
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
  brand: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  wordmark: {
    width: 160,
    height: 44,
  },
  ornamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  list: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.card,
  },
  optionSelected: {
    borderColor: colors.accentGold,
  },
  flagChip: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: {
    fontSize: 22,
  },
  optionLabel: {
    ...typography.h1,
    color: colors.textPrimary,
    flex: 1,
  },
  optionLabelSelected: {
    color: colors.primary,
  },
  checkBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
});
