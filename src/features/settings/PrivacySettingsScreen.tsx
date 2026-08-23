import { Check } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

  return (
    <SettingsScreenLayout title={t('settings.privacy.title')} onPressBack={onPressBack}>
      <OptionGroup
        title={t('settings.privacy.profileVisibility')}
        options={[
          { value: 'public', label: t('settings.privacy.public') },
          { value: 'friends', label: t('settings.privacy.friendsOnly') },
          { value: 'private', label: t('settings.privacy.private') },
        ]}
        selected={preferences.profileVisibility}
        onSelect={(value) => onChange('profileVisibility', value)}
      />

      <OptionGroup
        title={t('settings.privacy.leaderboardVisibility')}
        options={[
          { value: 'visible', label: t('settings.privacy.visible') },
          { value: 'hidden', label: t('settings.privacy.hidden') },
        ]}
        selected={preferences.leaderboardVisibility}
        onSelect={(value) => onChange('leaderboardVisibility', value)}
      />

      <OptionGroup
        title={t('settings.privacy.activityVisibility')}
        options={[
          { value: 'public', label: t('settings.privacy.public') },
          { value: 'friends', label: t('settings.privacy.friendsOnly') },
          { value: 'private', label: t('settings.privacy.private') },
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
