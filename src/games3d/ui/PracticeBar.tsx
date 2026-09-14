import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TextButton } from '@/components/ui';
import { radii, spacing } from '@/theme';

type PracticeBarProps = {
  visible: boolean;
  onReset: () => void;
  onExit: () => void;
  resetLabel: string;
  exitLabel: string;
};

/** Small floating control row for practice modes (Section "Make Practice...
 * intentionally different") - a practice session has no natural end (no
 * win/loss, often no turn limit), so it needs its own always-visible way
 * to reset and to leave, instead of relying on a result screen that may
 * never appear. Shared by Ordo/Chuko/Kok Boru; Kyz Kuumai's training
 * course has its own checkpoint HUD instead since "reset" there means
 * restarting the course, not clearing a board. */
export function PracticeBar({ visible, onReset, onExit, resetLabel, exitLabel }: PracticeBarProps) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <View style={[styles.row, { top: insets.top + 64 }]} pointerEvents="box-none">
      <View style={styles.pill}>
        <TextButton label={resetLabel} tone="primary" onPress={onReset} />
      </View>
      <View style={styles.pill}>
        <TextButton label={exitLabel} tone="muted" onPress={onExit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pill: {
    backgroundColor: 'rgba(20,14,8,0.55)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
