import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Toggle } from '@/components/ui';
import type { GamePreferences } from '@/store/useSettingsStore';
import { colors, radii, spacing, typography } from '@/theme';

import { SettingsScreenLayout } from './components/SettingsScreenLayout';

const ROW_IDS: (keyof GamePreferences)[] = ['soundEffects', 'music', 'haptics'];

type GameSettingsScreenProps = {
  preferences: GamePreferences;
  onChange: (id: keyof GamePreferences, value: boolean) => void;
  onPressBack: () => void;
};

export function GameSettingsScreen({ preferences, onChange, onPressBack }: GameSettingsScreenProps) {
  const { t } = useTranslation();

  return (
    <SettingsScreenLayout title={t('settings.game.title')} onPressBack={onPressBack}>
      <View style={styles.group}>
        {ROW_IDS.map((id, index) => {
          const label = t(`settings.game.${id}`);
          return (
            <View key={id} style={[styles.row, index === ROW_IDS.length - 1 && styles.rowLast]}>
              <Text style={styles.label}>{label}</Text>
              <Toggle value={preferences[id]} onValueChange={(value) => onChange(id, value)} accessibilityLabel={label} />
            </View>
          );
        })}
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
