import { ChevronDown, ChevronUp, Info } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

export type LabId = 'oymo' | 'shyrdak' | 'bozUy' | 'komuz';

/**
 * Every Culture Lab explains, briefly: what the object/practice is, what
 * you do here, and what the digital version simplifies. Collapsed to one
 * line by default (adults see it open) so it never crowds the tool.
 */
export function LabAboutNote({ lab }: { lab: LabId }) {
  const { t } = useTranslation();
  const { experience } = useAgeExperience();
  const [open, setOpen] = useState(experience === 'adult');
  const rows = experience === 'child' ? (['whatYouDo'] as const) : (['whatItIs', 'whatYouDo', 'simplified'] as const);

  return (
    <View style={styles.box}>
      <AnimatedPressable
        style={styles.head}
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={t('culture.labs.aboutTitle')}
      >
        <Info size={16} color={colors.primary} strokeWidth={2.25} />
        <Text style={styles.title}>{t('culture.labs.aboutTitle')}</Text>
        {open ? <ChevronUp size={16} color={colors.textMuted} strokeWidth={2} /> : <ChevronDown size={16} color={colors.textMuted} strokeWidth={2} />}
      </AnimatedPressable>
      {open
        ? rows.map((row) => (
            <View key={row} style={styles.row}>
              <Text style={styles.label}>{t(`culture.labs.labels.${row}`)}</Text>
              <Text style={styles.text}>{t(`culture.labs.${lab}.${row}`)}</Text>
            </View>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 32 },
  title: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  row: { gap: 2 },
  label: { ...textStyles.small, fontWeight: '700', color: colors.textSecondary },
  text: { ...textStyles.caption, color: colors.textPrimary },
});
