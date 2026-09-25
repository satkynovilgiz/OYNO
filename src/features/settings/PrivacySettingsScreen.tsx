import { router } from 'expo-router';
import { AlarmClock, Cloud, Image as ImageIcon, NotebookPen, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { cardRadii, colors, spacing, textStyles } from '@/theme';

import { SettingsRow, SettingsSection } from './components/SettingsRow';
import { SettingsScreenLayout } from './components/SettingsScreenLayout';

/**
 * Privacy - plain explanations of what OYNO actually does with data, plus
 * the real controls that exist elsewhere (Reminders). There are no
 * visibility switches here: OYNO has no public profiles, leaderboards or
 * social activity, so such switches would do nothing.
 */
export function PrivacySettingsScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const facts: { icon: LucideIcon; title: string; body: string }[] = [
    { icon: NotebookPen, title: t('settings.v2.privacy.journalTitle'), body: t('settings.v2.privacy.journalBody') },
    { icon: Cloud, title: t('settings.v2.privacy.progressTitle'), body: t('settings.v2.privacy.progressBody') },
    { icon: ImageIcon, title: t('settings.v2.privacy.photosTitle'), body: t('settings.v2.privacy.photosBody') },
    { icon: AlarmClock, title: t('settings.v2.privacy.notificationsTitle'), body: t('settings.v2.privacy.notificationsBody') },
  ];

  return (
    <SettingsScreenLayout title={t('settings.privacy.title')} onPressBack={onPressBack}>
      <View style={styles.stack}>
        <Text style={styles.intro}>{t('settings.v2.privacy.intro')}</Text>
        <View style={styles.card}>
          {facts.map(({ icon: Icon, title, body }, index) => (
            <View key={title} style={[styles.fact, index > 0 && styles.factDivider]} accessible accessibilityLabel={`${title}. ${body}`}>
              <View style={styles.icon}>
                <Icon size={18} color={colors.primary} strokeWidth={2} />
              </View>
              <View style={styles.factText}>
                <Text style={styles.factTitle}>{title}</Text>
                <Text style={styles.factBody}>{body}</Text>
              </View>
            </View>
          ))}
        </View>
        <SettingsSection footer={t('settings.v2.privacy.deleteNote')}>
          <SettingsRow icon={AlarmClock} label={t('settings.v2.privacy.manageReminders')} onPress={() => router.push('/settings/reminders' as never)} />
        </SettingsSection>
      </View>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  intro: { ...textStyles.body, color: colors.textSecondary },
  card: { borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  fact: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  factDivider: { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.borderSubtle },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  factText: { flex: 1, gap: 3 },
  factTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  factBody: { ...textStyles.caption, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
});
