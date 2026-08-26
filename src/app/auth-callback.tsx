import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing, typography } from '@/theme';

/**
 * Landing target for the Google/Apple OAuth redirect (see
 * SupabaseAuthService.signInWithOAuth). The tab/sheet that lands here is
 * read directly by WebBrowser.openAuthSessionAsync back in the tab that
 * opened it - this screen never has to do anything with the URL itself,
 * it just needs to exist so the redirect has somewhere to land instead of
 * a 404 while that happens.
 */
export default function AuthCallbackRoute() {
  const { t } = useTranslation();

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
