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
import { StyleSheet, Text, View } from 'react-native';
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
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel="Артка" onPress={onPressBack} />
        <Text style={styles.title}>Жөндөөлөр</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionLabel}>Аккаунт</Text>
        <View style={styles.group}>
          <SettingsRow icon={CircleUser} label="Аккаунт" onPress={() => onNavigate('account')} />
          <SettingsRow icon={Globe} label="Тил" onPress={() => onNavigate('language')} />
        </View>

        <Text style={styles.sectionLabel}>Жалпы</Text>
        <View style={styles.group}>
          <SettingsRow icon={Bell} label="Билдирүүлөр" onPress={() => onNavigate('notifications')} />
          <SettingsRow icon={Lock} label="Купуялык" onPress={() => onNavigate('privacy')} />
          <SettingsRow icon={ShieldCheck} label="Коопсуздук" onPress={() => onNavigate('security')} />
          <SettingsRow icon={Gamepad2} label="Оюн жөндөөлөрү" onPress={() => onNavigate('game')} />
          <SettingsRow icon={Database} label="Кэш / Дайындар" onPress={() => onNavigate('data')} />
        </View>

        <Text style={styles.sectionLabel}>Колдоо</Text>
        <View style={styles.group}>
          <SettingsRow icon={HelpCircle} label="Жардам" onPress={() => onNavigate('help')} />
          <SettingsRow icon={Info} label="OYNO жөнүндө" onPress={() => onNavigate('about')} />
        </View>

        <View style={styles.group}>
          <SettingsRow
            icon={LogOut}
            label="Чыгуу"
            destructive
            showChevron={false}
            onPress={() => setSignOutVisible(true)}
          />
        </View>
      </View>

      <ConfirmationModal
        visible={signOutVisible}
        title="Аккаунттан чыгасызбы?"
        message="Кайра кирүү үчүн email жана сырсөзүңүз керек болот."
        confirmLabel="Чыгуу"
        cancelLabel="Жок"
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
