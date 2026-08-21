import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';

type BadgeProps = {
  label: string;
  color: string;
  textColor?: string;
};

/** Small color-coded tag (e.g. discovery category pills). Unlike `Pill`,
 * which only offers the primary/surface theme tones, `Badge` takes an
 * arbitrary background color so callers can color-code by category. */
export function Badge({ label, color, textColor = colors.textOnDark }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  label: {
    ...typography.small,
    fontWeight: '700',
  },
});
