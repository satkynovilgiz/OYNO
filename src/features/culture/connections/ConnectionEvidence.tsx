import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, textStyles } from '@/theme';

import { SOURCE_FIELD_LABEL, type CultureConnection } from './connectionsData';

/** The connection's evidence: the exact excerpt, attributed to its article section (shared by the detail screen and the map). */
export function ConnectionEvidence({ connection, sourceTitle, testID }: { connection: CultureConnection; sourceTitle: string | null; testID?: string }) {
  const { t } = useTranslation();
  const field = SOURCE_FIELD_LABEL[connection.source.field];
  return (
    <View style={styles.quote} testID={testID}>
      <Text style={styles.quoteLabel}>{t('culture.connections.inOynoWords')}</Text>
      <Text style={styles.quoteText}>“{connection.evidence}”</Text>
      <Text style={styles.attribution}>{t('culture.connections.fromArticle', { title: sourceTitle ?? connection.source.contentId, section: field ? t(field) : connection.source.field })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  quote: { gap: spacing.xs, paddingLeft: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.accentGold },
  quoteLabel: { ...textStyles.overline, color: colors.textSecondary },
  quoteText: { ...textStyles.body, fontSize: 17, lineHeight: 26, color: colors.textPrimary },
  attribution: { ...textStyles.small, color: colors.textMuted },
});
