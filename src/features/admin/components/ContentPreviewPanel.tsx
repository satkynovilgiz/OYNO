import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import type { TranslatedContentType } from '@/services/content/localizedContent';
import { colors, editorial, radii, spacing, textStyles, typography } from '@/theme';

import { previewFor, type AdminTranslationRow } from '../adminModel';
import type { AdminRow } from '../sections';

const STATUS_NOTE = {
  available: null,
  fallback_to_kg: 'Readers in this language see the Kyrgyz text (translation incomplete or not reviewed).',
  missing: 'No body text yet.',
} as const;

/** How the row will read in each language in the app - reviewed
 * translations only, same resolver as the app, unsaved Kyrgyz edits
 * included. */
export function ContentPreviewPanel({ contentType, row, translations, fieldLabel }: { contentType: TranslatedContentType; row: AdminRow; translations: readonly AdminTranslationRow[]; fieldLabel: (field: string) => string }) {
  const [language, setLanguage] = useState<SupportedLanguage>('kg');
  const preview = previewFor(contentType, row, language, translations);
  const note = STATUS_NOTE[preview.status];

  return (
    <View style={styles.wrap}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {(['kg', 'ru', 'en'] as const).map((option) => (
          <AnimatedPressable
            key={option}
            style={[styles.tab, language === option && styles.tabActive]}
            onPress={() => setLanguage(option)}
            accessibilityRole="tab"
            accessibilityState={{ selected: language === option }}
            accessibilityLabel={`Preview ${option.toUpperCase()}`}
          >
            <Text style={[styles.tabText, language === option && styles.tabTextActive]}>{option.toUpperCase()}</Text>
          </AnimatedPressable>
        ))}
      </View>
      <View style={styles.card}>
        {note ? <Text style={styles.note}>{note}</Text> : null}
        <Text style={styles.title}>{preview.title || '(no title)'}</Text>
        {preview.blocks.map((block) => (
          <View key={block.field} style={styles.block}>
            <Text style={styles.blockLabel}>{fieldLabel(block.field)}</Text>
            <Text style={styles.blockText}>{block.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  tabs: { flexDirection: 'row', gap: spacing.xs },
  tab: { minWidth: 48, alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.surfaceBorder, backgroundColor: colors.surface },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { ...typography.caption, fontWeight: '700', color: colors.textPrimary },
  tabTextActive: { color: colors.textOnPrimary },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surfaceElevated },
  note: { ...typography.small, color: colors.accentTerracotta },
  title: { ...editorial(textStyles.h2), color: colors.textPrimary },
  block: { gap: 2 },
  blockLabel: { ...typography.overline, color: colors.accentTerracotta },
  blockText: { ...textStyles.body, color: colors.textPrimary },
});
