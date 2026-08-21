import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

type SettingsRowProps = {
  icon: LucideIcon;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
};

export function SettingsRow({ icon: Icon, label, value, onPress, destructive = false, showChevron = true }: SettingsRowProps) {
  return (
    <AnimatedPressable style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.iconWrap, destructive && styles.iconWrapDestructive]}>
        <Icon size={18} color={destructive ? colors.danger : colors.primary} strokeWidth={1.75} />
      </View>
      <Text style={[styles.label, destructive && styles.labelDestructive]} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {showChevron ? <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} /> : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDestructive: {
    backgroundColor: 'rgba(214,69,69,0.12)',
  },
  label: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  labelDestructive: {
    color: colors.danger,
  },
  value: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
