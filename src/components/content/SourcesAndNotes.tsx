import * as WebBrowser from 'expo-web-browser';
import { BookOpen, ChevronRight, ExternalLink } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/ui';
import { track } from '@/services/analytics/analytics';
import { describeSources, normalizeVerification, verificationCopyKey, type SourceInfo } from '@/services/content/verification';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

type Props = {
  contentType: 'culture_item' | 'culture_material' | 'explore_region';
  level: string | null | undefined;
  sources: readonly string[] | null | undefined;
};

/**
 * Quiet "Sources & notes" row near the END of an article (never a warning
 * at the top). Opens a compact sheet: the review state in plain words and
 * the real recorded sources, each opened in the in-app browser with its own
 * site shown - OYNO never presents an external page as its own. No review
 * date is shown because none is stored.
 */
export function SourcesAndNotes({ contentType, level, sources }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const status = normalizeVerification(level);
  const list = describeSources(sources);
  const summary = list.length > 0 ? t('sources.count', { count: list.length }) : t('sources.none');

  return (
    <>
      <AnimatedPressable
        style={styles.row}
        onPress={() => {
          setOpen(true);
          // High-level only: type + state, never the URLs.
          track('sources_opened', { contentType, status });
        }}
        press="soft"
        accessibilityRole="button"
        accessibilityLabel={`${t('sources.title')}. ${t(verificationCopyKey(status))}. ${summary}`}
      >
        <BookOpen size={16} color={colors.textSecondary} strokeWidth={2} />
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{t('sources.title')}</Text>
          <Text style={styles.rowMeta} numberOfLines={2}>
            {t(verificationCopyKey(status))} · {summary}
          </Text>
        </View>
        <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
      </AnimatedPressable>
      <SourcesSheet visible={open} statusKey={verificationCopyKey(status)} sources={list} onClose={() => setOpen(false)} />
    </>
  );
}

function SourcesSheet({ visible, statusKey, sources, onClose }: { visible: boolean; statusKey: string; sources: SourceInfo[]; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  return (
    <Modal visible={visible} transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} accessibilityViewIsModal>
        <View style={styles.handle} />
        <Text style={styles.sheetTitle} accessibilityRole="header">
          {t('sources.title')}
        </Text>
        <Text style={styles.status}>{t(statusKey)}</Text>
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {sources.length === 0 ? <Text style={styles.empty}>{t('sources.noneLong')}</Text> : null}
          {sources.map((source) => (
            <AnimatedPressable
              key={source.url}
              style={styles.source}
              onPress={() => void WebBrowser.openBrowserAsync(source.url).catch(() => {})}
              press="soft"
              accessibilityRole="link"
              accessibilityLabel={`${source.name}, ${t(`sources.kinds.${source.kind}`)}. ${t('sources.view')}`}
            >
              <View style={styles.sourceText}>
                <Text style={styles.sourceName} numberOfLines={2}>
                  {source.name}
                </Text>
                <Text style={styles.sourceMeta} numberOfLines={1}>
                  {t(`sources.kinds.${source.kind}`)} · {source.host}
                </Text>
              </View>
              <ExternalLink size={16} color={colors.primary} strokeWidth={2} />
            </AnimatedPressable>
          ))}
        </ScrollView>
        <Text style={styles.note}>{t('sources.externalNote')}</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { ...textStyles.small, color: colors.textSecondary },
  backdrop: { flex: 1, backgroundColor: 'rgba(19,32,24,0.45)' },
  sheet: { maxHeight: '75%', paddingTop: spacing.xs, paddingHorizontal: spacing.lg, gap: spacing.xs, borderTopLeftRadius: cardRadii.hero, borderTopRightRadius: cardRadii.hero, backgroundColor: colors.background },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderSubtle, marginBottom: spacing.sm },
  sheetTitle: { ...textStyles.h2, color: colors.textPrimary },
  status: { ...textStyles.body, color: colors.textSecondary },
  list: { marginTop: spacing.xs },
  listContent: { gap: spacing.xs, paddingBottom: spacing.xs },
  empty: { ...textStyles.caption, color: colors.textMuted },
  source: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56, padding: spacing.sm, borderRadius: cardRadii.chip, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  sourceText: { flex: 1, gap: 2 },
  sourceName: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  sourceMeta: { ...textStyles.small, color: colors.textMuted },
  note: { ...textStyles.small, color: colors.textMuted, marginTop: spacing.xs },
});
