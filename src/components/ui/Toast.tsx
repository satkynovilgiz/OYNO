import * as Haptics from 'expo-haptics';
import { Check, Info } from 'lucide-react-native';
import { useEffect } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { colors, elevation, motion, radii, spacing, textStyles } from '@/theme';

type ToastTone = 'success' | 'info';
type ToastState = { id: number; message: string; tone: ToastTone } | null;

const useToastStore = create<{ toast: ToastState; show: (message: string, tone: ToastTone) => void; hide: (id: number) => void }>((set) => ({
  toast: null,
  show: (message, tone) => set({ toast: { id: Date.now(), message, tone } }),
  hide: (id) => set((state) => (state.toast?.id === id ? { toast: null } : state)),
}));

/**
 * Small confirmation for a real user action (Saved, Removed, Downloaded,
 * Journal saved, Copied) - never for navigation. One toast at a time; a new
 * one replaces the current. `haptic: true` adds a light success tap.
 */
export function showToast(message: string, options: { tone?: ToastTone; haptic?: boolean } = {}) {
  useToastStore.getState().show(message, options.tone ?? 'success');
  if (options.haptic && Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  AccessibilityInfo.announceForAccessibility?.(message);
}

/** Bottom clearance so a toast floats above the tab bar, not on it. */
const TAB_BAR_CLEARANCE = 84;

/** Mount once at the app root. */
export function ToastHost() {
  const toast = useToastStore((state) => state.toast);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (!toast) return;
    opacity.value = reducedMotion ? 1 : withTiming(1, { duration: motion.sheetEnter.durationMs });
    translateY.value = reducedMotion ? 0 : motion.sheetEnter.distance;
    if (!reducedMotion) translateY.value = withTiming(0, { duration: motion.sheetEnter.durationMs });
    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: reducedMotion ? 0 : motion.duration.fast });
      setTimeout(() => useToastStore.getState().hide(toast.id), reducedMotion ? 0 : motion.duration.fast);
    }, motion.toastVisibleMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: translateY.value }] }));

  if (!toast) return null;
  const Icon = toast.tone === 'success' ? Check : Info;
  return (
    <View style={[styles.host, { bottom: insets.bottom + TAB_BAR_CLEARANCE }]} pointerEvents="none">
      <Animated.View style={[styles.toast, animatedStyle]} accessibilityLiveRegion="polite" accessibilityRole="alert">
        <View style={[styles.icon, toast.tone === 'success' && styles.iconSuccess]}>
          <Icon size={14} color={toast.tone === 'success' ? colors.textPrimary : colors.textOnDark} strokeWidth={3} />
        </View>
        <Text style={styles.text} numberOfLines={2}>
          {toast.message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: spacing.md, right: spacing.md, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: 420, paddingVertical: spacing.sm, paddingLeft: spacing.sm, paddingRight: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surfaceFeature, ...elevation.floating },
  icon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(251,243,227,0.18)' },
  iconSuccess: { backgroundColor: colors.accentGold },
  text: { ...textStyles.bodyMedium, color: colors.textOnDark, flexShrink: 1 },
});
