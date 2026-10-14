import { type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { colors, controlStates, radii, shadows } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';
import { useMinTarget } from '@/services/comfort/useComfortStore';

type Variant = 'surface' | 'primary';
type Shape = 'circle' | 'roundedSquare';

type IconButtonProps = {
  icon: LucideIcon;
  onPress?: () => void;
  accessibilityLabel: string;
  testID?: string;
  size?: number;
  iconSize?: number;
  variant?: Variant;
  shape?: Shape;
  showBadge?: boolean;
  disabled?: boolean;
  /** Drop shadow - keep for controls floating over photography; pass
   * `false` for header controls on a flat cream background (tonal
   * surface + hairline instead). */
  elevated?: boolean;
  /** Looks and announces disabled but stays focusable (web drops keyboard focus from a disabled
   * <button>) - for controls that become unavailable right after being used (e.g. "move up" at the top). */
  keepFocusWhenDisabled?: boolean;
};

export function IconButton({
  icon: Icon,
  onPress,
  accessibilityLabel,
  testID,
  size = 44,
  iconSize,
  variant = 'surface',
  shape = 'circle',
  showBadge = false,
  disabled = false,
  elevated = true,
  keepFocusWhenDisabled = false,
}: IconButtonProps) {
  const [pressed, setPressed] = useState(false);
  // Web: react-native-web writes aria-disabled from the Pressable's own `disabled`, which a
  // focus-keeping control can't set - so the attribute is put on the DOM node directly.
  const webNode = useRef<{ setAttribute?: (name: string, value: string) => void } | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web' && keepFocusWhenDisabled) webNode.current?.setAttribute?.('aria-disabled', String(disabled));
  });
  const isPrimary = variant === 'primary';
  // Visual size can be smaller than the 44pt accessibility minimum touch
  // target (e.g. the 32px card arrow) - hitSlop makes up the difference
  // rather than forcing every icon button to look 44px.
  const target = useMinTarget();
  const hitSlopAmount = Math.max(0, Math.ceil((target - size) / 2));

  return (
    <AnimatedPressable
      testID={testID}
      onPress={disabled ? (keepFocusWhenDisabled ? () => undefined : undefined) : onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onLayout={
        Platform.OS === 'web' && keepFocusWhenDisabled
          ? (event) => {
              webNode.current = (event.nativeEvent as unknown as { target?: typeof webNode.current }).target ?? null;
              webNode.current?.setAttribute?.('aria-disabled', String(disabled));
            }
          : undefined
      }
      press="strong"
      disabled={keepFocusWhenDisabled ? undefined : disabled}
      hitSlop={hitSlopAmount}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      style={[
        styles.base,
        elevated ? shadows.card : styles.flat,
        {
          width: size,
          height: size,
          borderRadius: shape === 'circle' ? size / 2 : radii.lg,
          // Same state table as Button (theme/ui.ts): explicit pressed / disabled colours.
          backgroundColor: disabled ? controlStates.disabled.bg : isPrimary ? (pressed ? controlStates.primary.pressedBg : colors.primary) : pressed ? controlStates.secondary.pressedBg : colors.surface,
        },
      ]}
    >
      <Icon
        size={iconSize ?? Math.round(size * 0.45)}
        color={disabled ? controlStates.disabled.fg : isPrimary ? colors.textOnPrimary : colors.primary}
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
  flat: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
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
