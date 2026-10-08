import { router } from 'expo-router';
import { ArrowDown, ChevronLeft } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';
import { NotFoundState } from '@/components/system/NotFoundState';
import { Button, IconButton } from '@/components/ui';
import { track } from '@/services/analytics/analytics';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, spacing, textStyles, typography } from '@/theme';

import { ConnectionCard } from './ConnectionsSection';
import { contentRoute } from './connectionsData';
import { connectionById } from './connectionsModel';
import { useConnectionContent } from './useConnectionContent';

/** Field -> existing article section label. */
const FIELD_LABEL: Record<string, string> = {
  origin: 'culture.item.originLabel',
  history: 'culture.item.historyLabel',
  cultural_meaning: 'culture.item.culturalMeaningLabel',
  traditional_method: 'culture.item.traditionalMethodLabel',
  objects_used: 'culture.item.objectsUsedLabel',
};

/**
 * /culture/connections/[id] - "Explore the connection": both articles,
 * the relation label, and the explanation ONLY as OYNO's own authored
 * words (the cited excerpt, attributed to its article + section). The
 * source article's Sources & notes stays the authority for its facts.
 */
export function ConnectionDetailScreen({ connectionId, onPressBack }: { connectionId: string; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const content = useConnectionContent();
  const connection = connectionById(connectionId);

  useEffect(() => {
    if (connection) track('culture_connection_opened', { connection_id: connection.id, from_id: connection.fromId, to_id: connection.toId });
  }, [connection]);

  if (!connection) return <NotFoundState onPressBack={onPressBack} />;
  if (content.waitingForNetwork) return <OfflineUnavailable onRetry={content.retry} />;
  if (content.isLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  const from = content.get(connection.fromType, connection.fromId);
  const to = content.get(connection.toType, connection.toId);
  const source = content.get(connection.source.contentType, connection.source.contentId);
  if (!from || !to) return <NotFoundState onPressBack={onPressBack} />;
  const forward = { connection, direction: 'forward' as const, labelKey: connection.relationKey, otherType: connection.toType, otherId: connection.toId };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={[styles.kicker, { flex: 1 }]}>{t('culture.connections.exploreTitle')}</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Text style={styles.title} accessibilityRole="header">
          {from.title}
        </Text>
        <View style={styles.relationRow} accessible accessibilityLabel={t(`culture.connections.relation.${connection.relationKey}`)}>
          <ArrowDown size={18} color={colors.accentTerracotta} strokeWidth={2.25} />
          <Text style={styles.relation}>{t(`culture.connections.relation.${connection.relationKey}`)}</Text>
        </View>
        <ConnectionCard entry={forward} target={to} experience={experience} onPress={() => router.push(contentRoute(to.type, to.id) as never)} />

        <View style={styles.quote}>
          <Text style={styles.quoteLabel}>{t('culture.connections.inOynoWords')}</Text>
          <Text style={styles.quoteText}>“{connection.evidence}”</Text>
          <Text style={styles.attribution}>
            {t('culture.connections.fromArticle', { title: source?.title ?? connection.source.contentId, section: FIELD_LABEL[connection.source.field] ? t(FIELD_LABEL[connection.source.field]) : connection.source.field })}
          </Text>
        </View>

        <Button label={t('culture.connections.openArticle', { title: from.title })} variant="secondary" onPress={() => router.push(contentRoute(from.type, from.id) as never)} />
        <Button label={t('culture.connections.trail.start')} variant="secondary" accessibilityHint={t('culture.connections.trail.startA11y', { title: from.title })} onPress={() => router.push(`/culture/connections/trail?start=${encodeURIComponent(from.id)}${from.type === 'culture_material' ? '&type=culture_material' : ''}` as never)} testID="trail-start-detail" />
        {source ? <Button label={t('culture.connections.checkSources')} variant="secondary" onPress={() => router.push(contentRoute(source.type, source.id) as never)} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  kicker: { ...typography.overline, color: colors.accentTerracotta },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  title: { ...textStyles.display, color: colors.textPrimary },
  relationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  relation: { ...textStyles.title, fontSize: 17, color: colors.accentTerracotta },
  quote: { gap: spacing.xs, paddingLeft: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.accentGold },
  quoteLabel: { ...textStyles.overline, color: colors.textSecondary },
  quoteText: { ...textStyles.body, fontSize: 17, lineHeight: 26, color: colors.textPrimary },
  attribution: { ...textStyles.small, color: colors.textMuted },
});
