import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, Button, FadeSlideIn } from '@/components/ui';
import type { AgeGroup } from '@/services/ageExperience/types';
import { cardRadii, colors, editorial, spacing, textStyles } from '@/theme';

import { AGE_GROUP_OPTIONS } from './ageGroupOptions';

type AgeGroupScreenProps = {
  initialSelected: AgeGroup | null;
  onContinue: (ageGroup: AgeGroup) => void;
};

/**
 * Last first-run step: a self-selected age band (never a date of birth).
 * A compact 2x2 grid - the range is the headline, one neutral line says how
 * OYNO adapts for it (no stereotyped icons, no "are you a child?"). Same
 * four bands and the same `setAgeGroup` as before.
 */
export function AgeGroupScreen({ initialSelected, onContinue }: AgeGroupScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<AgeGroup | null>(initialSelected);

  return (
    <View style={styles.root}>
      <View style={[styles.content, { paddingTop: insets.top + spacing.xxl }]}>
        <View style={styles.heading}>
          <View style={styles.ornamentRow}>
            <OymoOrnament size={10} color={colors.accentGoldPressed} strokeWidth={1.75} />
            <OymoOrnament size={12} color={colors.accentGoldPressed} strokeWidth={1.75} />
            <OymoOrnament size={10} color={colors.accentGoldPressed} strokeWidth={1.75} />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {t('ageGroup.title')}
          </Text>
          <Text style={styles.subtitle}>{t('onboarding.v2.ageSubtitle')}</Text>
        </View>

        <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={t('ageGroup.title')}>
          {AGE_GROUP_OPTIONS.map((option, optionIndex) => {
            const isSelected = option.id === selected;
            return (
              <FadeSlideIn key={option.id} index={optionIndex} style={styles.cell}>
                <AnimatedPressable
                  onPress={() => setSelected(option.id)}
                  press="strong"
                  haptic="light"
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${t(option.labelKey)}. ${t(option.hintKey)}`}
                  style={[styles.card, isSelected && styles.cardSelected]}
                >
                  <View style={styles.cardTop}>
                    <Text style={[styles.range, isSelected && styles.rangeSelected]}>{option.id}</Text>
                    <View style={[styles.radio, isSelected && styles.radioSelected]}>{isSelected ? <Check size={12} color={colors.textOnPrimary} strokeWidth={3} /> : null}</View>
                  </View>
                  <Text style={styles.hint} numberOfLines={2}>
                    {t(option.hintKey)}
                  </Text>
                </AnimatedPressable>
              </FadeSlideIn>
            );
          })}
        </View>

        <Text style={styles.note}>{t('language.subtitle')}</Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label={t('ageGroup.continue')}
          variant="accent"
          size="lg"
          block
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
  root: { flex: 1, backgroundColor: colors.background, justifyContent: 'space-between' },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  heading: { gap: spacing.xs },
  ornamentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { ...editorial(textStyles.h1), color: colors.textPrimary },
  subtitle: { ...textStyles.body, color: colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { flexBasis: '47%', flexGrow: 1 },
  card: { minHeight: 118, padding: spacing.md, gap: 2, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 2, borderColor: 'transparent' },
  cardSelected: { borderColor: colors.primary },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  range: { ...textStyles.h1, color: colors.textPrimary },
  rangeSelected: { color: colors.primary },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.borderSubtle, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  radioSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  hint: { ...textStyles.caption, color: colors.textSecondary, marginTop: spacing.xxs },
  note: { ...textStyles.caption, color: colors.textMuted },
  footer: { paddingHorizontal: spacing.lg },
});
