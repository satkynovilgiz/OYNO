import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronLeft, MessageSquareWarning } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useCultureMaterials } from '@/services/content/cultureService';
import { formatShortDate, localDateKeyOf } from '@/services/i18n/formatDate';
import { supabase } from '@/services/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { useFeedbackStore } from '@/store/useFeedbackStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { isStatusUnavailable, toMyReports, type MyReport, type MyReportRow } from './myReports';

async function fetchMyReports(): Promise<MyReport[]> {
  const { data, error } = await supabase.rpc('get_my_feedback');
  if (error) throw error;
  return toMyReports((data ?? []) as MyReportRow[]);
}

/** /profile/reports - your own reports and their status (signed in only). */
export function MyReportsScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((state) => (state.status === 'authenticated' ? (state.user?.id ?? null) : null));
  // Keyed by the account: B never sees A's cached list.
  const query = useQuery({ queryKey: ['my_feedback', userId], queryFn: fetchMyReports, enabled: !!userId });
  const { data: items } = useAllCultureItems();
  const { data: materials } = useCultureMaterials();

  const contentTitle = (report: MyReport): string | null => {
    if (!report.content) return null;
    const { type, id } = report.content;
    const title = type === 'culture_item' ? items?.find((row) => row.id === id)?.title : type === 'culture_material' ? materials?.find((row) => row.id === id)?.title : undefined;
    if (title) return title;
    // Lists loaded and the content isn't there any more.
    if ((type === 'culture_item' && items) || (type === 'culture_material' && materials)) return t('myReports.contentUnavailable');
    return t(`myReports.contentType.${type}`, { defaultValue: t('myReports.content') });
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header">
          {t('myReports.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        {!userId ? <Text style={styles.meta}>{t('myReports.signedOut')}</Text> : null}
        {query.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {query.error ? <Text style={styles.meta}>{isStatusUnavailable(query.error) ? t('myReports.unavailable') : t('myReports.loadError')}</Text> : null}
        {query.data && query.data.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('myReports.empty')}</Text>
            <Text style={styles.meta}>{t('myReports.needHelp')}</Text>
            <Button label={t('myReports.sendFeedback')} variant="secondary" onPress={() => useFeedbackStore.getState().open({ source: 'settings' })} />
          </View>
        ) : null}
        {(query.data ?? []).map((report) => {
          const key = localDateKeyOf(report.createdAt);
          const submitted = key ? formatShortDate(key, i18n.language as SupportedLanguage) : '';
          const content = contentTitle(report);
          return (
            <View key={report.id} style={styles.card} accessible accessibilityLabel={`${t(`myReports.category.${report.category}`, { defaultValue: report.category })}. ${content ?? ''}. ${t('myReports.submitted')} ${submitted}. ${t(`myReports.status.${report.status}`)}`}>
              <View style={styles.cardHead}>
                <MessageSquareWarning size={16} color={colors.textSecondary} strokeWidth={2} />
                <Text style={styles.category}>{t(`myReports.category.${report.category}`, { defaultValue: report.category })}</Text>
                <Text style={[styles.status, report.status === 'resolved' && styles.statusResolved]}>{t(`myReports.status.${report.status}`)}</Text>
              </View>
              {content ? <Text style={styles.contentTitle}>{content}</Text> : null}
              <Text style={styles.meta}>
                {t('myReports.submitted')} {submitted}
              </Text>
              {report.publicResponse ? <Text style={styles.response}>{report.publicResponse}</Text> : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Profile entry - only for a signed-in account (guest reports are anonymous). */
export function useShowMyReports(): boolean {
  return useAuthStore((state) => state.status === 'authenticated' && !!state.user);
}

export function openMyReports(): void {
  router.push('/profile/reports' as never);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  card: { gap: 4, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  category: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  status: { ...textStyles.small, fontWeight: '700', color: colors.textSecondary },
  statusResolved: { color: colors.primary },
  contentTitle: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  response: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt },
  empty: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  emptyTitle: { ...typography.h2, color: colors.textPrimary },
});
