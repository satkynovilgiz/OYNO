import { router } from 'expo-router';
import Constants from 'expo-constants';
import { AlarmClock, CloudDownload, Database, Gamepad2, Globe, HelpCircle, Info, Lock, LogOut, MessageSquareWarning, Palette, ShieldCheck, Sparkles, Wrench, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { UserAvatar } from '@/components/avatar';
import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, Button, ConfirmationModal } from '@/components/ui';
import { useAdminRole } from '@/services/admin/adminService';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useOfflineStore } from '@/services/offline/useOfflineStore';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useAvatarStore } from '@/store/useAvatarStore';
import { useFeedbackStore } from '@/store/useFeedbackStore';
import { useReminderSettingsStore } from '@/store/useReminderSettingsStore';
import { cardRadii, colors, editorial, spacing, textStyles } from '@/theme';

import { SettingsRow, SettingsSection } from './components/SettingsRow';
import { SettingsScreenLayout } from './components/SettingsScreenLayout';
import { ageGroupLabel, buildSettingsSections, enabledReminderCount, languageLabel, versionLabel, type SettingsRowId } from './settingsModel';

type SettingsScreenProps = {
  onPressBack: () => void;
  onSignOut: () => Promise<void>;
};

/**
 * Settings: a compact account block, then small grouped sections -
 * Experience, Personalization, Content & reminders, Privacy & data,
 * Support, About - with Sign out set apart at the end (signed-in only).
 * Every row leads to a real screen or action; values shown on the right are
 * the real current state (language, age range, reminders, downloads).
 */
export function SettingsScreen({ onPressBack, onSignOut }: SettingsScreenProps) {
  useTrackScreenView('settings');
  const { t, i18n } = useTranslation();
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const characterId = useAppStore((state) => state.characterId) ?? 'bek';
  const avatarConfig = useAvatarStore((state) => (state.hasEverSaved ? state.config : null));
  const { ageGroup } = useAgeExperience();
  const reminders = useReminderSettingsStore((state) => state.settings);
  const downloads = useOfflineStore((state) => Object.keys(state.manifest.entries).length);
  const { data: adminRole } = useAdminRole();
  const [signOutVisible, setSignOutVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signedIn = status === 'authenticated' && !!user;
  const sections = buildSettingsSections(signedIn ? 'signedIn' : 'guest', !!adminRole);
  const reminderCount = enabledReminderCount(reminders);

  useEffect(() => {
    if (!useReminderSettingsStore.getState().isLoaded) void useReminderSettingsStore.getState().load();
  }, []);

  const go = (route: string) => router.push(route as never);

  const ROWS: Record<SettingsRowId, { icon: LucideIcon; label: string; subtitle?: string; value?: string; onPress: () => void }> = {
    experience: { icon: Sparkles, label: t('settings.rows.experience'), value: ageGroupLabel(ageGroup), onPress: () => go('/settings/experience') },
    language: { icon: Globe, label: t('settings.rows.language'), value: languageLabel(i18n.language), onPress: () => go('/settings/language') },
    appearance: { icon: Palette, label: t('settings.rows.appearance'), subtitle: t('settings.v2.appearanceSubtitle'), onPress: () => go('/appearance') },
    reminders: { icon: AlarmClock, label: t('settings.rows.reminders'), value: reminderCount > 0 ? t('settings.v2.remindersOn', { count: reminderCount }) : t('settings.v2.off'), onPress: () => go('/settings/reminders') },
    offline: { icon: CloudDownload, label: t('offline.library.title'), value: downloads > 0 ? t('settings.v2.downloads', { count: downloads }) : t('settings.v2.noDownloads'), onPress: () => go('/offline') },
    game: { icon: Gamepad2, label: t('settings.rows.game'), subtitle: t('settings.v2.gameSubtitle'), onPress: () => go('/settings/game') },
    privacy: { icon: Lock, label: t('settings.rows.privacy'), onPress: () => go('/settings/privacy') },
    security: { icon: ShieldCheck, label: t('settings.rows.security'), onPress: () => go('/settings/security') },
    storage: { icon: Database, label: t('settings.v2.storage'), onPress: () => go('/settings/data') },
    help: { icon: HelpCircle, label: t('settings.rows.help'), onPress: () => go('/settings/help') },
    report: { icon: MessageSquareWarning, label: t('settings.v2.reportProblem'), onPress: () => useFeedbackStore.getState().open({ source: 'settings' }) },
    about: { icon: Info, label: t('settings.rows.about'), value: versionLabel(Constants.expoConfig?.version, null), onPress: () => go('/settings/about') },
    admin: { icon: Wrench, label: t('settings.rows.adminPanel'), onPress: () => go('/admin') },
  };

  const handleConfirmSignOut = async () => {
    setIsSigningOut(true);
    await onSignOut();
    setIsSigningOut(false);
    setSignOutVisible(false);
  };

  return (
    <SettingsScreenLayout title={t('settings.title')} onPressBack={onPressBack}>
      <View style={styles.stack}>
        {/* Account block - compact; the full Profile lives elsewhere. */}
        {signedIn ? (
          <AnimatedPressable style={styles.account} onPress={() => go('/settings/account')} press="soft" accessibilityRole="button" accessibilityLabel={`${user.name}. ${user.email}. ${t('settings.v2.manageAccount')}`}>
            <View style={styles.avatar}>
              <UserAvatar characterId={characterId} avatarConfig={avatarConfig} size="medium" />
            </View>
            <View style={styles.accountText}>
              <Text style={styles.accountName} numberOfLines={1}>
                {user.name}
              </Text>
              <Text style={styles.accountMeta} numberOfLines={1}>
                {user.email}
              </Text>
              <Text style={styles.accountLink}>{t('settings.v2.manageAccount')} ›</Text>
            </View>
          </AnimatedPressable>
        ) : (
          <View style={styles.account}>
            <View style={[styles.avatar, styles.guestAvatar]}>
              <OymoOrnament size={22} color={colors.accentGoldPressed} strokeWidth={1.5} />
            </View>
            <View style={styles.accountText}>
              <Text style={styles.accountName}>{t('settings.v2.guestTitle')}</Text>
              <Text style={styles.accountMeta}>{t('settings.v2.guestBody')}</Text>
              <View style={styles.guestActions}>
                <Button label={t('settings.v2.signIn')} variant="primary" size="sm" onPress={() => go('/sign-in')} />
                <Button label={t('settings.v2.createAccount')} variant="text" size="sm" onPress={() => go('/sign-up')} />
              </View>
            </View>
          </View>
        )}

        {sections.map((section) => (
          <SettingsSection key={section.id} title={section.id === 'admin' ? t('settings.sections.admin') : t(`settings.v2.sections.${section.id}`)}>
            {section.rows.map((id) => {
              const row = ROWS[id];
              return <SettingsRow key={id} icon={row.icon} label={row.label} subtitle={row.subtitle} value={row.value} onPress={row.onPress} />;
            })}
          </SettingsSection>
        ))}

        {/* Destructive action set apart from preferences. */}
        {signedIn ? (
          <SettingsSection>
            <SettingsRow icon={LogOut} label={t('settings.signOut.rowLabel')} destructive showChevron={false} onPress={() => setSignOutVisible(true)} />
          </SettingsSection>
        ) : null}
      </View>

      <ConfirmationModal
        visible={signOutVisible}
        title={t('settings.signOut.title')}
        message={t('settings.signOut.message')}
        confirmLabel={t('settings.signOut.confirm')}
        cancelLabel={t('settings.signOut.cancel')}
        destructive
        isConfirming={isSigningOut}
        onConfirm={handleConfirmSignOut}
        onCancel={() => setSignOutVisible(false)}
      />
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  account: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: cardRadii.media, backgroundColor: colors.surfaceElevated },
  avatar: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.accentGold, backgroundColor: colors.surfaceMuted },
  guestAvatar: { borderStyle: 'dashed', borderColor: colors.border },
  accountText: { flex: 1, gap: 2, minWidth: 0 },
  accountName: { ...editorial(textStyles.h3), color: colors.textPrimary },
  accountMeta: { ...textStyles.caption, color: colors.textSecondary },
  accountLink: { ...textStyles.caption, fontWeight: '700', color: colors.primary, marginTop: 2 },
  guestActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
});
