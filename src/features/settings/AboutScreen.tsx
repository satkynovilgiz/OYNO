import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';
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

/** Short OTA build fingerprint (spec: no such requirement - added purely
 * as a support/debug aid) so a screenshot of this screen tells us exactly
 * which published update a device is actually running, instead of
 * guessing from what's visually rendered. `Updates.updateId` is null when
 * running the embedded (non-OTA) bundle, e.g. a fresh install or dev
 * build. */
function formatUpdateInfo(): string {
  if (!Updates.isEmbeddedLaunch && Updates.updateId) {
    const created = Updates.createdAt ? new Date(Updates.createdAt).toLocaleString() : '—';
    return `${Updates.updateId.slice(0, 8)} · ${created}`;
  }
  return 'embedded (no OTA update applied)';
}

export function AboutScreen({ onPressBack }: AboutScreenProps) {
  const { t } = useTranslation();
  const version = Constants.expoConfig?.version ?? '—';
  const updateInfo = formatUpdateInfo();

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
        <Text style={styles.updateInfo}>Update: {updateInfo}</Text>
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
  updateInfo: {
    ...typography.small,
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
