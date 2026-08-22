import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { authService, AuthError, useAuthCallbackParams } from '@/services/auth';
import { colors, spacing, typography } from '@/theme';

/** Where a tapped "Reset Password" email link lands
 * (SupabaseAuthService.requestPasswordReset's redirectTo). Deliberately
 * does not touch useAuthStore's status - see completeFromEmailLink's doc
 * comment - it only establishes the ambient Supabase session
 * confirmPasswordReset needs, then hands off to the "set new password"
 * screen. */
export default function AuthCallbackRecoveryRoute() {
  const params = useAuthCallbackParams();
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (params === null || hasRun.current) return;
    hasRun.current = true;

    const linkParams = params.code
      ? { code: params.code }
      : params.accessToken && params.refreshToken
        ? { accessToken: params.accessToken, refreshToken: params.refreshToken }
        : null;

    if (!linkParams) {
      setError(params.errorDescription ?? 'Шилтеме жараксыз же мөөнөтү бүткөн.');
      return;
    }
    (async () => {
      try {
        await authService.completeFromEmailLink(linkParams);
        router.replace('/reset-password');
      } catch (err) {
        setError(err instanceof AuthError ? err.message : 'Шилтеме жараксыз же мөөнөтү бүткөн.');
      }
    })();
  }, [params]);

  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {error ? (
        <View style={styles.content}>
          <Text style={styles.title}>Шилтеме иштебей жатат</Text>
          <Text style={styles.message}>{error}</Text>
          <Button label="Кайра сурануу" onPress={() => router.replace('/forgot-password')} />
        </View>
      ) : (
        <ActivityIndicator size="large" color={colors.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  content: {
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
