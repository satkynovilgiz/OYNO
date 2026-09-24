import { type ErrorBoundaryProps, router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, TextButton } from '@/components/ui';
import { recordDiagnostic } from '@/services/feedback/diagnosticTrail';
import { errorFingerprint } from '@/services/feedback/diagnostics';
import { captureException } from '@/services/monitoring/sentry';
import { useFeedbackStore } from '@/store/useFeedbackStore';
import { colors, spacing, typography } from '@/theme';

/**
 * Screen-level fallback for feature routes (re-exported as a route's
 * `ErrorBoundary`). A crash inside one feature - the map, a challenge, a
 * wallpaper preview - stays inside that screen: the user can retry it or
 * go back, and the rest of OYNO keeps its state. The root ErrorBoundary
 * remains the last resort for crashes outside any route.
 */
export function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (__DEV__) console.error('[RouteErrorBoundary] screen crashed:', error);
    captureException(error, { scope: 'route' });
    recordDiagnostic('screen_error', errorFingerprint(error));
  }, [error]);

  return (
    <View style={styles.root} accessibilityRole="alert">
      <Text style={styles.title}>{t('errorBoundary.title')}</Text>
      <Text style={styles.message}>{t('errorBoundary.screenMessage')}</Text>
      <View style={styles.actions}>
        <Button label={t('common.retry')} onPress={() => void retry()} />
        <Button label={t('common.back')} variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />
        {/* Only a content-free fingerprint goes with the report, never the stack. */}
        <TextButton label={t('feedback.reportProblem')} onPress={() => useFeedbackStore.getState().open({ source: 'error', category: 'bug', errorFingerprint: errorFingerprint(error) })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  title: { ...typography.h1, color: colors.textPrimary, textAlign: 'center' },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: spacing.sm, alignItems: 'stretch' },
});
