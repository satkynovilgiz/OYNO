import { StyleSheet, Text, View } from 'react-native';

import { Toggle } from '@/components/ui';
import type { NotificationPreferenceId, NotificationPreferences } from '@/store/useSettingsStore';
import { colors, radii, spacing, typography } from '@/theme';

import { SettingsScreenLayout } from './components/SettingsScreenLayout';

const ROWS: { id: NotificationPreferenceId; label: string }[] = [
  { id: 'dailyChallenge', label: 'Күнүмдүк тапшырма' },
  { id: 'rewards', label: 'Сыйлыктар' },
  { id: 'achievements', label: 'Жетишкендиктер' },
  { id: 'friendRequests', label: 'Досторго кошуу сунуштары' },
  { id: 'gameInvitations', label: 'Оюнга чакыруулар' },
  { id: 'events', label: 'Иш-чаралар' },
  { id: 'news', label: 'Жаңылыктар' },
];

type NotificationSettingsScreenProps = {
  preferences: NotificationPreferences;
  onChange: (id: NotificationPreferenceId, value: boolean) => void;
  onPressBack: () => void;
};

export function NotificationSettingsScreen({ preferences, onChange, onPressBack }: NotificationSettingsScreenProps) {
  return (
    <SettingsScreenLayout title="Билдирүүлөр" onPressBack={onPressBack}>
      <View style={styles.group}>
        {ROWS.map((row, index) => (
          <View key={row.id} style={[styles.row, index === ROWS.length - 1 && styles.rowLast]}>
            <Text style={styles.label}>{row.label}</Text>
            <Toggle
              value={preferences[row.id]}
              onValueChange={(value) => onChange(row.id, value)}
              accessibilityLabel={row.label}
            />
          </View>
        ))}
      </View>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  label: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
});
