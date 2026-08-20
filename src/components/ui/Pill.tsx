import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';

type PillProps = {
  label: string;
  tone?: 'primary' | 'surface';
};

export function Pill({ label, tone = 'primary' }: PillProps) {
  const isPrimary = tone === 'primary';

  return (
    <View style={[styles.pill, { backgroundColor: isPrimary ? colors.primary : colors.surfaceAlt }]}>
      <Text style={[typography.small, { color: isPrimary ? colors.textOnPrimary : colors.textPrimary }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
  },
});
