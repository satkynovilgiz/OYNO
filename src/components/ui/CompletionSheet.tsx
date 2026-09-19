import * as Haptics from 'expo-haptics';
import { type ReactNode, useEffect } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { colors, radii, spacing } from '@/theme';

type CompletionSheetProps = {
  visible: boolean;
  children: ReactNode;
};

/**
 * Shared chrome for every "something meaningful just finished" moment
 * (spec "Task 9... Do not implement five unrelated completion modals -
 * create a reusable foundation with variants") - backdrop, ornament-
 * flanked gold-bordered sheet, and a restrained scale+fade entrance with a
 * single success haptic, all in one place instead of each completion
 * surface reinventing its own. `ResultScreen` (games) is built on this;
 * `AchievementUnlockedModal` already independently arrived at the same
 * visual language (ornament row, gold border, spring-in) and is a natural
 * candidate to move onto this shared chrome too, left as-is here since it
 * already works well and isn't broken.
 *
 * No confetti, no particles, no neon - a single subtle scale (0.92 -> 1)
 * + fade, skipped entirely under Reduce Motion, and a haptic that only
 * fires once per genuine completion (on the transition into `visible`,
 * not on every re-render while already visible).
 */
export function CompletionSheet({ visible, children }: CompletionSheetProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(reducedMotion ? 1 : 0.92);
  const opacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (!visible) return;
    if (reducedMotion) {
      scale.value = 1;
      opacity.value = 1;
    } else {
      scale.value = 0.92;
      opacity.value = 0;
      scale.value = withTiming(1, { duration: 320 });
      opacity.value = withTiming(1, { duration: 260 });
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View style={styles.ornamentRow}>
            <OymoOrnament size={11} color={colors.accentGold} strokeWidth={1.5} />
            <OymoOrnament size={13} color={colors.accentGold} strokeWidth={1.5} />
            <OymoOrnament size={11} color={colors.accentGold} strokeWidth={1.5} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(19,32,24,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.accentGold,
  },
  ornamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
