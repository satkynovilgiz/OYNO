import { Pause } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/theme';

type GameHUDProps = {
  title: string;
  onPause: () => void;
  /** Left-aligned stat, e.g. score. */
  primaryStat?: { label: string; value: string };
  /** Right-aligned stat, e.g. arrows remaining or time left. */
  secondaryStat?: { label: string; value: string };
};

/** Minimal shared HUD chrome (Section 20): back/pause top-left, title
 * centered, one or two compact stat pills - never a large card over the 3D
 * scene. Respects safe areas for landscape play (Section 91). */
export function GameHUD({ title, onPause, primaryStat, secondaryStat }: GameHUDProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.root, { paddingTop: insets.top + spacing.xs, paddingHorizontal: insets.left + spacing.sm }]}
    >
      <View style={styles.row} pointerEvents="box-none">
        <Pressable
          onPress={onPause}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="pause"
          style={styles.pauseButton}
        >
          <Pause size={20} color={colors.textOnDark} strokeWidth={2.25} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.statsRow}>
          {primaryStat ? <StatPill label={primaryStat.label} value={primaryStat.value} /> : null}
          {secondaryStat ? <StatPill label={secondaryStat.label} value={secondaryStat.value} /> : null}
        </View>
      </View>
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={styles.pillValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pauseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(20,14,8,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.bodyBold,
    color: colors.textOnDark,
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    backgroundColor: 'rgba(20,14,8,0.55)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  pillLabel: {
    ...typography.small,
    color: 'rgba(255,255,255,0.75)',
  },
  pillValue: {
    ...typography.bodyBold,
    color: colors.textOnDark,
  },
});
