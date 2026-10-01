import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { KyrgyzOnlyNote } from '@/components/content/KyrgyzOnlyNote';
import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable } from '@/components/ui';
import type { AgeExperience } from '@/services/ageExperience/types';
import type { CultureItemRow } from '@/services/content/types';
import { colors, editorial, radii, spacing, textStyles } from '@/theme';

import { FIELD_LABEL_KEY, THEN_NOW_PRESENTATION, thenAndNowFor, type ThenNowPart } from './thenAndNow';

/**
 * Then & Now on a culture article: the first authored historical field
 * and the authored modern field, stacked (never side-by-side on a phone),
 * visually truncated - the words are the editor's, never rewritten.
 * Renders nothing when the item lacks either side.
 */
export function ThenAndNowSection({ item, experience, language, onPressOpen }: { item: CultureItemRow; experience: AgeExperience; language: string; onPressOpen: () => void }) {
  const { t } = useTranslation();
  const model = thenAndNowFor(item);
  if (!model) return null;
  const presentation = THEN_NOW_PRESENTATION[experience];
  const headingKey = presentation.headings === 'simple' ? 'simple' : 'standard';

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <OymoOrnament size={12} color={colors.accentGold} strokeWidth={1.75} />
        <Text style={[styles.title, presentation.editorial && styles.titleEditorial]} accessibilityRole="header">
          {t('thenNow.title')}
        </Text>
      </View>
      <KyrgyzOnlyNote status={item.translation?.status} language={language} />
      <Side tone="then" heading={t(`thenNow.then.${headingKey}`)} part={model.then[0]} lines={presentation.excerptLines} />
      <Side tone="now" heading={t(`thenNow.now.${headingKey}`)} part={model.now[0]} lines={presentation.excerptLines} />
      <AnimatedPressable style={styles.open} onPress={onPressOpen} accessibilityRole="button" accessibilityLabel={t('thenNow.seeComparison')}>
        <Text style={styles.openText}>{t('thenNow.seeComparison')}</Text>
        <ChevronRight size={16} color={colors.primary} strokeWidth={2.25} />
      </AnimatedPressable>
    </View>
  );
}

function Side({ tone, heading, part, lines }: { tone: 'then' | 'now'; heading: string; part: ThenNowPart; lines: number }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.side, tone === 'then' ? styles.sideThen : styles.sideNow]}>
      <Text style={[styles.heading, tone === 'now' && styles.headingNow]} accessibilityRole="header">
        {heading}
      </Text>
      <Text style={styles.fieldLabel}>{t(FIELD_LABEL_KEY[part.field])}</Text>
      <Text style={styles.excerpt} numberOfLines={lines}>
        {part.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...textStyles.overline, color: colors.accentTerracotta },
  titleEditorial: { ...editorial(textStyles.overline) },
  side: { gap: 4, padding: spacing.md, borderRadius: radii.lg, borderLeftWidth: 3 },
  sideThen: { backgroundColor: colors.surfaceAlt, borderLeftColor: colors.accentGold },
  sideNow: { backgroundColor: colors.surface, borderLeftColor: colors.primary },
  heading: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.accentGoldPressed },
  headingNow: { color: colors.primary },
  fieldLabel: { ...textStyles.small, color: colors.textMuted },
  excerpt: { ...textStyles.body, color: colors.textPrimary },
  open: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 44 },
  openText: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.primary },
});
