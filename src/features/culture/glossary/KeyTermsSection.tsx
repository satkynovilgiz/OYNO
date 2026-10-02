import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

import { glossaryRoute } from './glossaryData';
import { keyTermsFor } from './glossaryModel';
import { useGlossary } from './useGlossary';

/** "Key terms" on an article - from the explicit KEY_TERMS_BY_ITEM mapping
 * only (no scanning or auto-linking of article text). */
export function KeyTermsSection({ itemId }: { itemId: string }) {
  const { t } = useTranslation();
  const { entries } = useGlossary();
  const terms = keyTermsFor(itemId, entries);
  if (terms.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">
        {t('glossary.keyTerms')}
      </Text>
      <View style={styles.chips}>
        {terms.map(({ entry }) => (
          <AnimatedPressable key={entry.id} style={styles.chip} onPress={() => router.push(glossaryRoute(entry.id) as never)} press="soft" accessibilityRole="link" accessibilityLabel={`${entry.term}. ${t('glossary.termA11y')}.`}>
            <Text style={styles.chipText}>{entry.term}</Text>
          </AnimatedPressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs },
  title: { ...textStyles.overline, color: colors.accentTerracotta },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: cardRadii.chip, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  chipText: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.primary },
});
