import { Flag } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import type { ReportContentType } from '@/services/feedback/reportContent';
import { useFeedbackStore } from '@/store/useFeedbackStore';
import { colors, spacing, typography } from '@/theme';

/** A quiet "Report an issue" line at the end of a content page. Opens the
 * feedback sheet already knowing which content it's about (its public id),
 * so the reader never retypes the title. */
export function ReportIssueLink({ contentType, contentId, title }: { contentType: ReportContentType; contentId: string; title: string }) {
  const { t } = useTranslation();
  return (
    <AnimatedPressable
      style={styles.link}
      onPress={() => useFeedbackStore.getState().open({ source: 'content', category: 'culture_correction', content: { contentType, contentId, title } })}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('feedback.reportIssue')}
      accessibilityHint={t('feedback.reportIssueHint')}
    >
      <Flag size={13} color={colors.textMuted} strokeWidth={2} />
      <Text style={styles.text}>{t('feedback.reportIssue')}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, minHeight: 44, paddingVertical: spacing.xs },
  text: { ...typography.small, fontWeight: '600', color: colors.textMuted },
});
