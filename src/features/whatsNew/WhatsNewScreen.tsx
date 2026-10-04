import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, IconButton } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { formatShortDate, localDateKeyOf } from '@/services/i18n/formatDate';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { useWhatsNew, useWhatsNewSeen } from './useWhatsNew';
import type { WhatsNewItem } from './whatsNew';

/** /whats-new - new and updated stories, from real timestamps only. */
export function WhatsNewScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { items } = useWhatsNew();
  useEffect(() => {
    // Opening the screen is what "seen" means (device-level).
    void useWhatsNewSeen.getState().load().then(() => useWhatsNewSeen.getState().markViewed());
  }, []);
  const fresh = items.filter((item) => item.kind === 'new');
  const updated = items.filter((item) => item.kind === 'updated');

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header">
          {t('whatsNew.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('whatsNew.upToDate')}</Text>
            <Text style={styles.meta}>{t('whatsNew.upToDateBody')}</Text>
          </View>
        ) : null}
        {fresh.length > 0 ? <Section title={t('whatsNew.new')} items={fresh} /> : null}
        {updated.length > 0 ? <Section title={t('whatsNew.recentlyUpdated')} items={updated} /> : null}
      </ScrollView>
    </View>
  );
}

function Section({ title, items }: { title: string; items: WhatsNewItem[] }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={styles.section} accessibilityRole="header">
        {title}
      </Text>
      {items.map((item) => (
        <Row key={`${item.type}:${item.id}`} item={item} />
      ))}
    </View>
  );
}

function Row({ item }: { item: WhatsNewItem }) {
  const { t, i18n } = useTranslation();
  const key = localDateKeyOf(item.at);
  const date = key ? formatShortDate(key, i18n.language as SupportedLanguage) : '';
  const label = item.kind === 'new' ? t('whatsNew.newStory') : t('whatsNew.updatedOn', { date });
  return (
    <AnimatedPressable style={styles.row} onPress={() => router.push(item.route as never)} accessibilityRole="button" accessibilityLabel={`${item.title}. ${label}${item.note ? `. ${item.note}` : ''}`}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.meta}>{label}</Text>
        {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
      </View>
      <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
    </AnimatedPressable>
  );
}

/** Home: a compact entry ONLY when there are unseen updates (max 3 titles). */
export function WhatsNewHomeEntry() {
  const { t } = useTranslation();
  const { unseen } = useWhatsNew();
  if (unseen.length === 0) return null;
  const titles = unseen.slice(0, 3).map((item) => item.title).join(' · ');
  return (
    <AnimatedPressable style={[styles.row, { marginTop: spacing.sm }]} onPress={() => router.push('/whats-new' as never)} accessibilityRole="button" accessibilityLabel={`${t('whatsNew.title')}. ${t('whatsNew.count', { count: unseen.length })}`}>
      <Sparkles size={18} color={colors.accentTerracotta} strokeWidth={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle}>
          {t('whatsNew.title')} · {t('whatsNew.count', { count: unseen.length })}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {titles}
        </Text>
      </View>
      <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  section: { ...typography.overline, color: colors.accentTerracotta },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  rowTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  note: { ...textStyles.small, color: colors.textPrimary, fontStyle: 'italic' },
  empty: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  emptyTitle: { ...typography.h2, color: colors.textPrimary },
});
