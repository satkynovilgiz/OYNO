import { StyleSheet, Text, View } from 'react-native';

import { Toggle } from '@/components/ui';
import type { GamePreferences } from '@/store/useSettingsStore';
import { colors, radii, spacing, typography } from '@/theme';

import { SettingsScreenLayout } from './components/SettingsScreenLayout';

const ROWS: { id: keyof GamePreferences; label: string }[] = [
  { id: 'soundEffects', label: 'Үн эффекттери' },
  { id: 'music', label: 'Музыка' },
  { id: 'haptics', label: 'Дирилдөө (Haptics)' },
];

type GameSettingsScreenProps = {
  preferences: GamePreferences;
  onChange: (id: keyof GamePreferences, value: boolean) => void;
  onPressBack: () => void;
};

export function GameSettingsScreen({ preferences, onChange, onPressBack }: GameSettingsScreenProps) {
  return (
    <SettingsScreenLayout title="Оюн жөндөөлөрү" onPressBack={onPressBack}>
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
