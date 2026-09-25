import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, Button, FadeSlideIn, MediaImage } from '@/components/ui';
import { openingImage } from '@/features/onboarding/data';
import type { SupportedLanguage } from '@/i18n';
import { colors, editorial, radii, spacing, textStyles } from '@/theme';
import wordmark from '@assets/splash-wordmark.png';

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

/**
 * First launch: the cinematic opening and the language choice in one
 * screen. Full-bleed Kyrgyz landscape, the OYNO wordmark, the localized
 * tagline, three large language choices (tapping one switches the whole
 * screen's text immediately - `setLanguage` changes i18n at once) and one
 * gold "Start". Persistence is unchanged: the route marks the language
 * chosen on Start, exactly as before.
 */
export function LanguageSelectScreen({ selected, onSelect, onContinue }: LanguageSelectScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <MediaImage source={openingImage} position="top" />
      <LinearGradient
        colors={['rgba(19,32,24,0.1)', 'rgba(19,32,24,0.15)', 'rgba(19,32,24,0.82)', 'rgba(19,32,24,0.97)']}
        locations={[0, 0.3, 0.55, 0.78]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.brand, { top: insets.top + spacing.lg }]} accessible accessibilityRole="header" accessibilityLabel="OYNO">
        <View style={styles.wordmarkBadge}>
          <Image source={wordmark} style={styles.wordmark} resizeMode="contain" />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} bounces={false} showsVerticalScrollIndicator={false}>
        <FadeSlideIn>
          <View style={styles.ornamentRow}>
            <OymoOrnament size={10} color={colors.accentGold} strokeWidth={1.75} />
            <OymoOrnament size={12} color={colors.accentGold} strokeWidth={1.75} />
            <OymoOrnament size={10} color={colors.accentGold} strokeWidth={1.75} />
          </View>
          <Text style={styles.tagline}>{t('home.header.tagline')}</Text>
        </FadeSlideIn>

        <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel={t('language.title')}>
          {LANGUAGE_OPTIONS.map((option, optionIndex) => {
            const isSelected = option.id === selected;
            return (
              <FadeSlideIn key={option.id} index={optionIndex + 1}>
                <AnimatedPressable
                  onPress={() => onSelect(option.id)}
                  press="strong"
                  haptic="light"
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={option.label}
                  style={[styles.option, isSelected && styles.optionSelected]}
                >
                  <Text style={styles.flag}>{option.flag}</Text>
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>{option.label}</Text>
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>{isSelected ? <Check size={13} color={colors.textOnPrimary} strokeWidth={3} /> : null}</View>
                </AnimatedPressable>
              </FadeSlideIn>
            );
          })}
        </View>

        <Text style={styles.hint}>{t('onboarding.v2.languageHint')}</Text>

        <Button label={t('onboarding.start')} variant="accent" size="lg" block onPress={onContinue} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceFeature },
  brand: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  wordmarkBadge: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: 'rgba(251,243,227,0.92)' },
  wordmark: { width: 132, height: 25 },
  scroll: { flexGrow: 0, marginTop: 'auto' },
  sheet: { paddingHorizontal: spacing.lg, gap: spacing.md },
  ornamentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  tagline: { ...editorial(textStyles.display), color: colors.textOnDark },
  list: { gap: spacing.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(251,243,227,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251,243,227,0.2)',
  },
  optionSelected: { backgroundColor: colors.surfaceElevated, borderColor: colors.accentGold },
  flag: { fontSize: 20 },
  optionLabel: { ...textStyles.title, color: colors.textOnDark, flex: 1 },
  optionLabelSelected: { color: colors.primary },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: 'rgba(251,243,227,0.5)', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  hint: { ...textStyles.caption, color: colors.textOnDarkSecondary },
});
