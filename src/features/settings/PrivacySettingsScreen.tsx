import { Check } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import type { PrivacyPreferences } from '@/store/useSettingsStore';
import { colors, radii, spacing, typography } from '@/theme';

import { SettingsScreenLayout } from './components/SettingsScreenLayout';

type PrivacySettingsScreenProps = {
  preferences: PrivacyPreferences;
  onChange: <K extends keyof PrivacyPreferences>(key: K, value: PrivacyPreferences[K]) => void;
  onPressBack: () => void;
};

export function PrivacySettingsScreen({ preferences, onChange, onPressBack }: PrivacySettingsScreenProps) {
  return (
    <SettingsScreenLayout title="Купуялык" onPressBack={onPressBack}>
      <OptionGroup
        title="Профилдин көрүнүшү"
        options={[
          { value: 'public', label: 'Ачык' },
          { value: 'friends', label: 'Достор гана' },
          { value: 'private', label: 'Жеке' },
        ]}
        selected={preferences.profileVisibility}
        onSelect={(value) => onChange('profileVisibility', value)}
      />

      <OptionGroup
        title="Рейтингде көрүнүү"
        options={[
          { value: 'visible', label: 'Көрүнөт' },
          { value: 'hidden', label: 'Жашырылган' },
        ]}
        selected={preferences.leaderboardVisibility}
        onSelect={(value) => onChange('leaderboardVisibility', value)}
      />

      <OptionGroup
        title="Активдүүлүктүн көрүнүшү"
        options={[
          { value: 'public', label: 'Ачык' },
          { value: 'friends', label: 'Достор гана' },
          { value: 'private', label: 'Жеке' },
        ]}
        selected={preferences.activityVisibility}
        onSelect={(value) => onChange('activityVisibility', value)}
      />
    </SettingsScreenLayout>
  );
}

function OptionGroup<T extends string>({
  title,
  options,
  selected,
  onSelect,
}: {
  title: string;
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.group}>
        {options.map((option) => {
          const isSelected = option.value === selected;
          return (
            <AnimatedPressable
              key={option.value}
              style={styles.row}
              onPress={() => onSelect(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={option.label}
            >
              <Text style={styles.rowLabel}>{option.label}</Text>
              {isSelected ? <Check size={18} color={colors.primary} strokeWidth={2.5} /> : null}
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typography.overline,
    color: colors.textSecondary,
  },
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
  },
  rowLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
});
