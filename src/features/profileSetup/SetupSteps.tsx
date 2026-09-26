import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, textStyles } from '@/theme';

import { PROFILE_SETUP_STEPS } from './profileSetupModel';

/** Quiet "Step 2 of 3" + three dots - progress without wizard chrome. */
export function SetupSteps({ current }: { current: number }) {
  const { t } = useTranslation();
  const total = PROFILE_SETUP_STEPS.length;
  const label = t('profileSetup.v2.step', { current, total });
  return (
    <View style={styles.row} accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 1, max: total, now: current }}>
      {PROFILE_SETUP_STEPS.map((step, index) => (
        <View key={step} style={[styles.dot, index + 1 === current && styles.dotActive, index + 1 < current && styles.dotDone]} />
      ))}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.borderSubtle },
  dotActive: { width: 22, backgroundColor: colors.primary },
  dotDone: { backgroundColor: colors.accentGold },
  label: { ...textStyles.small, color: colors.textSecondary, marginLeft: spacing.xs },
});
