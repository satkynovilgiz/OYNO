import {
  Bell,
  ChevronLeft,
  CircleUser,
  Database,
  Gamepad2,
  Globe,
  HelpCircle,
  Info,
  LogOut,
  Lock,
  ShieldCheck,
} from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmationModal, IconButton } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

import { SettingsRow } from './components/SettingsRow';

type SettingsScreenProps = {
  onPressBack: () => void;
  onNavigate: (section: 'account' | 'language' | 'notifications' | 'privacy' | 'security' | 'game' | 'data' | 'help' | 'about') => void;
  onSignOut: () => Promise<void>;
};

export function SettingsScreen({ onPressBack, onNavigate, onSignOut }: SettingsScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [signOutVisible, setSignOutVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleConfirmSignOut = async () => {
    setIsSigningOut(true);
    await onSignOut();
    setIsSigningOut(false);
    setSignOutVisible(false);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('settings.backLabel')} onPress={onPressBack} />
        <Text style={styles.title}>{t('settings.title')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>{t('settings.sections.account')}</Text>
        <View style={styles.group}>
          <SettingsRow icon={CircleUser} label={t('settings.rows.account')} onPress={() => onNavigate('account')} />
          <SettingsRow icon={Globe} label={t('settings.rows.language')} onPress={() => onNavigate('language')} />
        </View>

        <Text style={styles.sectionLabel}>{t('settings.sections.general')}</Text>
        <View style={styles.group}>
          <SettingsRow icon={Bell} label={t('settings.rows.notifications')} onPress={() => onNavigate('notifications')} />
          <SettingsRow icon={Lock} label={t('settings.rows.privacy')} onPress={() => onNavigate('privacy')} />
          <SettingsRow icon={ShieldCheck} label={t('settings.rows.security')} onPress={() => onNavigate('security')} />
          <SettingsRow icon={Gamepad2} label={t('settings.rows.game')} onPress={() => onNavigate('game')} />
          <SettingsRow icon={Database} label={t('settings.rows.data')} onPress={() => onNavigate('data')} />
        </View>

        <Text style={styles.sectionLabel}>{t('settings.sections.support')}</Text>
        <View style={styles.group}>
          <SettingsRow icon={HelpCircle} label={t('settings.rows.help')} onPress={() => onNavigate('help')} />
          <SettingsRow icon={Info} label={t('settings.rows.about')} onPress={() => onNavigate('about')} />
        </View>

        <View style={styles.group}>
          <SettingsRow
            icon={LogOut}
            label={t('settings.signOut.rowLabel')}
            destructive
            showChevron={false}
            onPress={() => setSignOutVisible(true)}
          />
        </View>
      </ScrollView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  sectionLabel: {
    ...typography.overline,
    color: colors.textSecondary,
    marginBottom: -spacing.sm,
  },
  group: {
    gap: spacing.xs,
  },
});
