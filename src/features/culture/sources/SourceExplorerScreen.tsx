import * as WebBrowser from 'expo-web-browser';
import { ChevronLeft, ExternalLink, Link2Off } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, IconButton } from '@/components/ui';
import { track } from '@/services/analytics/analytics';
import { verificationCopyKey } from '@/services/content/verification';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { explanationKey, explorerSources, FIELD_MAPPINGS_AVAILABLE, safeExternalUrl } from './sourceExplorer';

/**
 * /culture/item/[id]/sources and /culture/material/[id]/sources - one
 * reusable screen. Shows THIS story's own sources only (never merged with
 * another story's), its existing verification and a fixed explanation.
 * Metadata works offline from the cached story; opening a link needs a
 * connection.
 */
export function SourceExplorerScreen({ contentType, contentId, title, level, sources, onPressBack }: { contentType: 'culture_item' | 'culture_material'; contentId: string; title: string; level: string | null; sources: string[] | null; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isOffline } = useNetworkStatus();
  const why = explanationKey(level);
  const list = explorerSources(sources);

  useEffect(() => {
    track('source_explorer_opened', { content_id: contentId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId]);

  const open = (url: string, sourceId: string) => {
    const safe = safeExternalUrl(url);
    if (!safe) return;
    track('external_source_opened', { content_id: contentId, source_id: sourceId });
    void WebBrowser.openBrowserAsync(safe).catch(() => undefined);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>{t('sourceExplorer.title')}</Text>
          <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
            {title}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={[styles.statusCard, why.level === 'unverified' && styles.statusUnverified]} accessible accessibilityLabel={`${t(verificationCopyKey(why.level))}. ${t(why.key)}`}>
          <Text style={styles.section}>{t('sourceExplorer.whyTitle')}</Text>
          <Text style={styles.status}>{t(`sourceExplorer.level.${why.level}`)}</Text>
          <Text style={styles.body}>{t(why.key)}</Text>
        </View>

        <Text style={styles.section} accessibilityRole="header">
          {t('sourceExplorer.sources')} ({list.filter((entry) => entry.kind === 'link').length})
        </Text>
        {list.length === 0 ? <Text style={styles.meta}>{t('sources.noneLong')}</Text> : null}
        {list.map((entry) =>
          entry.kind === 'link' ? (
            <View key={entry.id} style={styles.source}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.sourceName}>{entry.info.name}</Text>
                <Text style={styles.meta}>
                  {t(`sources.kinds.${entry.info.kind}`)} · {t('sourceExplorer.externalWebsite')} · {entry.info.host}
                </Text>
                <Text style={styles.meta}>{FIELD_MAPPINGS_AVAILABLE ? '' : t('sourceExplorer.supportsWhole')}</Text>
              </View>
              <AnimatedPressable style={styles.open} disabled={isOffline} onPress={() => open(entry.info.url, entry.id)} accessibilityRole="link" accessibilityState={{ disabled: isOffline }} accessibilityLabel={`${t('sourceExplorer.openSource')}: ${entry.info.name}`}>
                <ExternalLink size={16} color={isOffline ? colors.textMuted : colors.primary} strokeWidth={2} />
                <Text style={[styles.openText, isOffline && { color: colors.textMuted }]}>{t('sourceExplorer.openSource')}</Text>
              </AnimatedPressable>
            </View>
          ) : (
            <View key={entry.id} style={styles.source} accessible accessibilityLabel={t('sourceExplorer.sourceUnavailable')}>
              <Link2Off size={16} color={colors.textMuted} strokeWidth={2} />
              <Text style={[styles.meta, { flex: 1 }]}>{t('sourceExplorer.sourceUnavailable')}</Text>
            </View>
          ),
        )}
        {isOffline ? <Text style={styles.meta}>{t('sourceExplorer.offlineNote')}</Text> : null}
        <Text style={styles.note}>{t('sourceExplorer.footnote')}</Text>
        <Text style={styles.note}>{t('sources.externalNote')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  kicker: { ...typography.overline, color: colors.accentTerracotta },
  title: { ...textStyles.h3, color: colors.textPrimary },
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  statusCard: { gap: 4, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderLeftWidth: 3, borderLeftColor: colors.primary },
  statusUnverified: { borderLeftColor: colors.accentTerracotta },
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.xs },
  status: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  body: { ...textStyles.body, color: colors.textPrimary },
  source: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, minHeight: 56, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  sourceName: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  open: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: spacing.xs },
  openText: { ...textStyles.small, fontWeight: '700', color: colors.primary },
  note: { ...textStyles.small, color: colors.textMuted },
});
