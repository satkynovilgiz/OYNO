import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';

import { colors, spacing, typography } from '@/theme';

/**
 * Landing target for the Google/Apple OAuth redirect (see
 * SupabaseAuthService.signInWithOAuth). On native, the OS-level auth
 * session (ASWebAuthenticationSession/Custom Tabs) intercepts the
 * oyno:// redirect directly and this screen never even mounts. On web,
 * WebBrowser.openAuthSessionAsync in the opener tab only resolves once
 * *this* popup calls maybeCompleteAuthSession() - that's what postMessages
 * the final URL back to the opener (see expo-web-browser's web source);
 * without it the popup just sits here and the opener hangs until its own
 * 3-minute timeout. maybeCompleteAuthSession() is a no-op on native.
 */
export default function AuthCallbackRoute() {
  const { t } = useTranslation();

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>{t('auth.signIn.completingSignIn')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  text: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
