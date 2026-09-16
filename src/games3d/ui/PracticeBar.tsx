import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TextButton } from '@/components/ui';
import { radii, spacing } from '@/theme';

import { GAME_HUD_HEIGHT } from './GameHUD';

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
 * restarting the course, not clearing a board.
 *
 * Sits just below `GameHUD` (`GAME_HUD_HEIGHT`, not a second guessed
 * offset) and matches its warm dark-card/gold-border language (Section
 * "Polish the HUD design") rather than the flat dark pill this used to be,
 * so practice's own controls read as part of the same HUD system. */
export function PracticeBar({ visible, onReset, onExit, resetLabel, exitLabel }: PracticeBarProps) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <View style={[styles.row, { top: insets.top + spacing.xs + GAME_HUD_HEIGHT + spacing.xs }]} pointerEvents="box-none">
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
    backgroundColor: 'rgba(43,32,25,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(232,185,61,0.3)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
