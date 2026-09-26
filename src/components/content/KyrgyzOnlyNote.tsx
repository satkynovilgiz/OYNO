import { Languages } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { TranslationStatus } from '@/services/content/localizedContent';
import { colors, spacing, textStyles } from '@/theme';

/** One quiet line when a text body is shown in its canonical Kyrgyz
 * because no reviewed RU/EN translation exists yet - never a banner, and
 * never shown to Kyrgyz readers or when the translation is there. */
export function KyrgyzOnlyNote({ status, language }: { status: TranslationStatus | undefined; language: string }) {
  const { t } = useTranslation();
  if (language === 'kg' || status !== 'fallback_to_kg') return null;
  return (
    <View style={styles.row} accessibilityRole="text">
      <Languages size={14} color={colors.textMuted} strokeWidth={2} />
      <Text style={styles.text}>{t('content.kyrgyzOnly')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  text: { ...textStyles.small, color: colors.textMuted, flexShrink: 1 },
});
