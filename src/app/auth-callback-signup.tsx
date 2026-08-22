import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { useAuthCallbackParams } from '@/services/auth';
import { useAuthStore } from '@/store/useAuthStore';
import { colors, spacing, typography } from '@/theme';

/** Where a tapped "Confirm signup" email link actually lands
 * (SupabaseAuthService.signUp's emailRedirectTo) - exchanges the link's
 * params for a real session and continues the new-user flow into profile
 * setup. */
export default function AuthCallbackSignUpRoute() {
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
      const ok = await useAuthStore.getState().completeSignupVerification(linkParams);
      if (ok) {
        router.replace('/profile-setup');
      } else {
        setError(useAuthStore.getState().error ?? 'Шилтеме жараксыз же мөөнөтү бүткөн.');
      }
    })();
  }, [params]);

  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {error ? (
        <View style={styles.content}>
          <Text style={styles.title}>Ырастоо ишке ашкан жок</Text>
          <Text style={styles.message}>{error}</Text>
          <Button label="Кайра катталуу" onPress={() => router.replace('/sign-up')} />
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
