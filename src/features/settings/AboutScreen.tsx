import Constants from 'expo-constants';
import { router } from 'expo-router';
import { FileText, Scale, ScrollText } from 'lucide-react-native';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing, typography } from '@/theme';
import wordmark from '@assets/img/OYNO_design/wordmark.png';

import { SettingsRow } from './components/SettingsRow';
import { SettingsScreenLayout } from './components/SettingsScreenLayout';

type AboutScreenProps = {
  onPressBack: () => void;
};

export function AboutScreen({ onPressBack }: AboutScreenProps) {
  const { t } = useTranslation();
  const version = Constants.expoConfig?.version ?? '—';

  /** Licenses (third-party OSS attributions) still have no real content
   * generated yet, so it keeps the honest "not available yet" notice.
   * Privacy Policy and Terms of Use now have real text - see
   * src/i18n/locales/*.json "legal" key - though it's a first draft, not
   * legal counsel's, and should get a real review before an app store
   * submission. */
  function showUnavailable(title: string) {
    Alert.alert(title, t('settings.about.unavailable'));
  }

  return (
    <SettingsScreenLayout title={t('settings.about.title')} onPressBack={onPressBack}>
      <View style={styles.hero}>
        <Image source={wordmark} style={styles.wordmark} resizeMode="contain" />
        <Text style={styles.version}>{t('settings.about.version', { version })}</Text>
      </View>

      <Text style={styles.mission}>{t('settings.about.mission')}</Text>

      <View style={styles.group}>
        <SettingsRow
          icon={FileText}
          label={t('settings.about.privacyPolicy')}
          onPress={() => router.push('/settings/privacy-policy' as never)}
        />
        <SettingsRow
          icon={ScrollText}
          label={t('settings.about.termsOfUse')}
          onPress={() => router.push('/settings/terms-of-use' as never)}
        />
        <SettingsRow icon={Scale} label={t('settings.about.licenses')} onPress={() => showUnavailable(t('settings.about.licenses'))} />
      </View>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  wordmark: {
    width: 180,
    height: 48,
  },
  version: {
    ...typography.caption,
    color: colors.textMuted,
  },
  mission: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  group: {
    gap: spacing.xs,
    marginTop: spacing.md,
  },
});
