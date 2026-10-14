import { Focus } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button } from '@/components/ui';
import { useReaderSettingsStore } from '@/store/useReaderSettingsStore';
import { colors, controlStates, iconSizes, layout, radii, spacing, text } from '@/theme';

/**
 * Focus view - an optional calmer reading view over the EXISTING reader
 * setting (`focusMode`, device-level). It only hides secondary interface:
 * the text, its sources, Report, audio, text settings, contents, personal
 * notes and glossary access always stay (focusView.ts lists both).
 */
export function setFocusView(on: boolean, announce: (message: string) => void) {
  if (useReaderSettingsStore.getState().focusMode === on) return;
  useReaderSettingsStore.getState().update({ focusMode: on });
  announce(on ? 'on' : 'off');
}

function useAnnounce() {
  const { t } = useTranslation();
  return (state: string) => AccessibilityInfo.announceForAccessibility(state === 'on' ? t('focusView.announceOn') : t('focusView.announceOff'));
}

/** Header toggle - stays visible in Focus view, so the same control also leaves it. */
export function FocusViewButton({ on, elevated }: { on: boolean; elevated?: boolean }) {
  const { t } = useTranslation();
  const announce = useAnnounce();
  return (
    <AnimatedPressable
      style={[styles.toggle, on && styles.toggleOn, elevated && !on && styles.toggleElevated]}
      onPress={() => setFocusView(!on, announce)}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={on ? t('focusView.exit') : t('focusView.enter')}
      accessibilityHint={on ? undefined : t('focusView.enterHint')}
      accessibilityState={{ selected: on }}
      aria-pressed={on}
      testID="focus-view-toggle"
    >
      <Focus size={iconSizes.md} color={on ? controlStates.selected.fg : colors.primary} strokeWidth={2.25} />
    </AnimatedPressable>
  );
}

/**
 * The entry that is reachable from ANY reading position: the header toggle
 * scrolls away with the article (and focusing it scrolls back to the top),
 * so this one floats over the corner of the reading area. Placed first in
 * the reading area so keyboard users reach it without tabbing through the
 * whole article.
 */
export function FocusFloatingButton({ on }: { on: boolean }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const announce = useAnnounce();
  if (on) return null;
  return (
    <View style={[styles.floating, { bottom: insets.bottom + spacing.md }]} pointerEvents="box-none">
      <AnimatedPressable
        style={styles.floatingButton}
        onPress={() => setFocusView(true, announce)}
        accessibilityRole="button"
        accessibilityLabel={t('focusView.enter')}
        accessibilityHint={t('focusView.enterHint')}
        testID="focus-view-floating"
      >
        <Focus size={iconSizes.md} color={colors.textOnPrimary} strokeWidth={2.25} />
        <Text style={styles.floatingText}>{t('focusView.short')}</Text>
      </AnimatedPressable>
    </View>
  );
}

/**
 * The clear exit, under the article while Focus view is on (in the layout,
 * never covering text). Escape leaves it on web/keyboards.
 */
export function FocusExitBar({ on }: { on: boolean }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const announce = useAnnounce();
  const announceRef = useRef(announce);
  announceRef.current = announce;
  useEffect(() => {
    if (!on || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFocusView(false, announceRef.current);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [on]);
  if (!on) return null;
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.xs }]} testID="focus-exit-bar">
      <View style={styles.barInner}>
        <View style={styles.flex}>
          <Text style={styles.barTitle}>{t('focusView.active')}</Text>
          <Text style={styles.barMeta}>{t('focusView.activeHint')}</Text>
        </View>
        <Button label={t('focusView.exit')} variant="secondary" size="sm" onPress={() => setFocusView(false, announce)} testID="focus-view-exit" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { minWidth: 40, height: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  toggleOn: { backgroundColor: controlStates.selected.bg, borderColor: controlStates.selected.border },
  toggleElevated: { shadowColor: colors.shadow, shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  floating: { position: 'absolute', right: layout.gutter, zIndex: 25 },
  floatingButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: radii.pill, backgroundColor: controlStates.primary.bg, shadowColor: colors.shadow, shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  floatingText: { ...text.fine, color: colors.textOnPrimary },
  bar: { borderTopWidth: 1, borderTopColor: colors.borderSubtle, backgroundColor: colors.surfaceElevated, paddingTop: spacing.xs, paddingHorizontal: layout.gutter },
  barInner: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  flex: { flex: 1, minWidth: 160 },
  barTitle: { ...text.emphasis, fontWeight: '700', color: colors.textPrimary },
  barMeta: { ...text.fine, color: colors.textSecondary },
});
