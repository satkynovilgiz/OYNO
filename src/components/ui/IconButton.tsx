import { type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { colors, radii, shadows } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';

type Variant = 'surface' | 'primary';
type Shape = 'circle' | 'roundedSquare';

type IconButtonProps = {
  icon: LucideIcon;
  onPress?: () => void;
  accessibilityLabel: string;
  size?: number;
  iconSize?: number;
  variant?: Variant;
  shape?: Shape;
  showBadge?: boolean;
};

export function IconButton({
  icon: Icon,
  onPress,
  accessibilityLabel,
  size = 44,
  iconSize,
  variant = 'surface',
  shape = 'circle',
  showBadge = false,
}: IconButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.base,
        shadows.card,
        {
          width: size,
          height: size,
          borderRadius: shape === 'circle' ? size / 2 : radii.lg,
          backgroundColor: isPrimary ? colors.primary : colors.surface,
        },
      ]}
    >
      <Icon
        size={iconSize ?? Math.round(size * 0.45)}
        color={isPrimary ? colors.textOnPrimary : colors.primary}
        strokeWidth={2.25}
      />
      {showBadge ? <View style={styles.badge} /> : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
