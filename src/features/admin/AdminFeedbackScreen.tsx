import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, IconButton } from '@/components/ui';
import { callAdminRpc, fetchViaRpc } from '@/services/admin/adminService';

import { FEEDBACK_INBOX_LIMIT, feedbackInboxError } from './adminModel';
import { colors, radii, spacing, typography } from '@/theme';

/** A report as admin_get_beta_feedback returns it - what the reporter sent,
 * without account identifiers (no user id; contact email only as a flag). */
export type AdminFeedbackRow = {
  id: string;
  created_at: string;
  category: string;
  message: string;
  content_type: string | null;
  content_id: string | null;
  content_language: string | null;
  suggested_correction: string | null;
  source_url: string | null;
  diagnostics: { appVersion?: string | null; platform?: string; osVersion?: string; language?: string; route?: string | null } | null;
  has_screenshot: boolean;
  has_contact_email: boolean;
};

type AdminFeedbackStatus = { id: string; status: string; status_updated_at: string | null; public_response: string | null };

/** Status + optional reply FOR THE REPORTER (shown in their My Reports).
 * There is no private-notes field: never write internal notes here. */
function StatusControls({ id, current, onSaved }: { id: string; current: AdminFeedbackStatus | null; onSaved: () => void }) {
  const [response, setResponse] = useState(current?.public_response ?? '');
  const [saving, setSaving] = useState(false);
  useEffect(() => setResponse(current?.public_response ?? ''), [current?.public_response]);
  const save = async (status: string) => {
    setSaving(true);
    try {
      await callAdminRpc('admin_set_feedback_status', { p_id: id, p_status: status, p_public_response: response.trim() || null });
      onSaved();
    } finally {
      setSaving(false);
    }
  };
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Report status">
        {['received', 'under_review', 'resolved', 'closed'].map((status) => (
          <AnimatedPressable key={status} style={[styles.chip, current?.status === status && styles.chipActive]} disabled={saving} onPress={() => void save(status)} accessibilityRole="radio" accessibilityState={{ checked: current?.status === status }} accessibilityLabel={status}>
            <Text style={[styles.chipText, current?.status === status && styles.chipTextActive]}>{status.replace('_', ' ')}</Text>
          </AnimatedPressable>
        ))}
      </View>
      <TextInput value={response} onChangeText={setResponse} maxLength={1000} placeholder="Optional reply the reporter will see (public)" style={styles.replyInput} accessibilityLabel="Public reply to the reporter" />
    </View>
  );
}

const FILTERS: { id: string | null; label: string }[] = [
  { id: null, label: 'All' },
  { id: 'bug', label: 'Bug' },
  { id: 'translation', label: 'Translation' },
  { id: 'culture_correction', label: 'Culture correction' },
  { id: 'image', label: 'Image' },
  { id: 'suggestion', label: 'Suggestion' },
];

/** Read-only inbox of beta feedback and content reports, filterable by
 * category. Nothing here edits content: a correction is a lead for an
 * editor to check against sources. Source links are shown as text, never
 * opened from here. */
export function AdminFeedbackScreen({ onPressBack }: { onPressBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['admin_feedback'], queryFn: () => fetchViaRpc<AdminFeedbackRow>('admin_get_beta_feedback') });
  const rows = (data ?? []).filter((row) => !category || row.category === category);
  // Status (20261003000002): same record the reporter sees in My Reports.
  // If that migration isn't applied yet, the controls simply don't show.
  const statuses = useQuery({ queryKey: ['admin_feedback_statuses'], queryFn: () => fetchViaRpc<AdminFeedbackStatus>('admin_get_feedback_statuses'), retry: false });
  const statusOf = (id: string) => statuses.data?.find((entry) => entry.id === id) ?? null;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel="Back" onPress={onPressBack} />
        <Text style={styles.title} numberOfLines={1}>
          Feedback & content reports
        </Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Category filter">
          {FILTERS.map((filter) => (
            <AnimatedPressable
              key={filter.label}
              style={[styles.chip, category === filter.id && styles.chipActive]}
              onPress={() => setCategory(filter.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: category === filter.id }}
              accessibilityLabel={filter.label}
            >
              <Text style={[styles.chipText, category === filter.id && styles.chipTextActive]}>{filter.label}</Text>
            </AnimatedPressable>
          ))}
        </View>
        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{feedbackInboxError(error as { message?: string; code?: string })}</Text> : null}
        {!isLoading && !error ? (
          <Text style={styles.muted}>
            {rows.length} shown · from the latest {FEEDBACK_INBOX_LIMIT} reports{(data?.length ?? 0) >= FEEDBACK_INBOX_LIMIT ? ' (older ones are in the Supabase dashboard)' : ''}
          </Text>
        ) : null}
        {!isLoading && !error && rows.length === 0 ? <Text style={styles.empty}>{category ? 'No reports in this category yet.' : 'No reports yet.'}</Text> : null}
        {rows.map((row) => (
          <View key={row.id} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.category}>{row.category}</Text>
              <Text style={styles.muted}>{new Date(row.created_at).toLocaleString()}</Text>
            </View>
            {row.content_id ? (
              <Text style={styles.meta} selectable>
                {row.content_type}:{row.content_id}
                {row.content_language ? ` · ${row.content_language}` : ''}
              </Text>
            ) : null}
            <Text style={styles.message} selectable>
              {row.message}
            </Text>
            {row.suggested_correction ? (
              <Text style={styles.message} selectable>
                <Text style={styles.label}>Suggested: </Text>
                {row.suggested_correction}
              </Text>
            ) : null}
            {row.source_url ? (
              <Text style={[styles.meta, styles.url]} selectable>
                Source (unverified, not opened): {row.source_url}
              </Text>
            ) : null}
            <Text style={styles.muted}>
              {[row.diagnostics?.platform, row.diagnostics?.osVersion, row.diagnostics?.appVersion && `v${row.diagnostics.appVersion}`, row.diagnostics?.language, row.diagnostics?.route].filter(Boolean).join(' · ')}
              {row.has_screenshot ? ' · has image' : ''}
              {row.has_contact_email ? ' · reporter shared an email (see dashboard)' : ''}
            </Text>
            {statuses.data ? <StatusControls id={row.id} current={statusOf(row.id)} onSaved={() => void statuses.refetch()} /> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  replyInput: { minHeight: 40, paddingHorizontal: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderSubtle, color: colors.textPrimary, backgroundColor: colors.surface },
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  title: { ...typography.bodyBold, fontSize: 17, color: colors.textPrimary, flex: 1, textAlign: 'center' },
  content: { paddingHorizontal: spacing.md, gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.textPrimary },
  chipTextActive: { color: colors.textOnPrimary, fontWeight: '700' },
  card: { gap: spacing.xs, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  category: { ...typography.overline, color: colors.accentTerracotta },
  meta: { ...typography.small, fontWeight: '600', color: colors.textSecondary },
  message: { ...typography.body, color: colors.textPrimary },
  label: { fontWeight: '700' },
  muted: { ...typography.small, color: colors.textMuted },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg },
  // Long links wrap instead of overflowing the card.
  url: Platform.OS === 'web' ? ({ wordBreak: 'break-all' } as object) : {},
  error: { ...typography.small, color: colors.danger },
});
