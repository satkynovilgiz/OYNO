import { Check, TriangleAlert } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { hapticNotify } from '@/services/comfort/haptics';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { colors, iconSizes, motion, spacing, text } from '@/theme';

import { begin, expire, INITIAL, SAVED_VISIBLE_MS, settle, type SaveMachine, type SaveState } from './saveFeedback';

/**
 * Run a save and reflect its REAL outcome. `run(save)` returns the save's
 * own boolean. A success / failure is confirmed with ONE optional haptic
 * (notification - the Comfort setting applies), never on the tap itself.
 */
export function useSaveFeedback(options: { haptics?: boolean } = {}) {
  const [machine, setMachine] = useState<SaveMachine>(INITIAL);
  const ref = useRef(machine);
  ref.current = machine;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const haptics = options.haptics !== false;

  const run = useCallback(
    async (save: () => Promise<boolean>): Promise<boolean> => {
      const started = begin(ref.current);
      ref.current = started;
      setMachine(started);
      let ok = false;
      try {
        ok = await save();
      } catch {
        ok = false;
      }
      if (!mounted.current) return ok;
      const next = settle(ref.current, started.seq, ok);
      if (next !== ref.current) {
        ref.current = next;
        setMachine(next);
        if (haptics) void hapticNotify(ok ? 'success' : 'error');
        if (ok)
          setTimeout(() => {
            if (!mounted.current) return;
            const after = expire(ref.current, started.seq);
            ref.current = after;
            setMachine(after);
          }, SAVED_VISIBLE_MS);
      }
      return ok;
    },
    [haptics],
  );
  return { state: machine.state, saving: machine.state === 'saving', run };
}

/**
 * The status line next to a save action: Saving… / Saved / Not saved.
 * Announced politely (assertive for a failure); never takes focus and never
 * blocks the controls around it. Under Reduce Motion it appears without a fade.
 */
export function SaveStatus({ state, savedLabel, failedLabel, testID = 'save-status' }: { state: SaveState; savedLabel?: string; failedLabel?: string; testID?: string }) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  if (state === 'idle') return <View style={styles.placeholder} testID={`${testID}-idle`} />;
  const content =
    state === 'saving' ? (
      <>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.text}>{t('feedbackStates.saving')}</Text>
      </>
    ) : state === 'saved' ? (
      <>
        <Check size={iconSizes.sm} color={colors.success} strokeWidth={2.5} />
        <Text style={styles.text}>{savedLabel ?? t('feedbackStates.saved')}</Text>
      </>
    ) : (
      <>
        <TriangleAlert size={iconSizes.sm} color={colors.dangerText} strokeWidth={2.25} />
        <Text style={[styles.text, styles.failed]}>{failedLabel ?? t('feedbackStates.failed')}</Text>
      </>
    );
  return (
    <Animated.View
      key={state}
      entering={reducedMotion ? undefined : FadeIn.duration(motion.duration.fast)}
      style={styles.row}
      pointerEvents="none"
      accessibilityLiveRegion={state === 'failed' ? 'assertive' : 'polite'}
      testID={`${testID}-${state}`}
    >
      {content}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Reserves the line so the layout doesn't jump when a status appears.
  placeholder: { minHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 20 },
  text: { ...text.meta, color: colors.textSecondary },
  failed: { color: colors.dangerText, fontWeight: '700' },
});
