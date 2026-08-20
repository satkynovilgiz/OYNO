import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import { BESH_TASH_STAGES } from '../engine';
import type { BeshTashGameState } from '../types';
import { CatchRing } from './CatchRing';
import { Stone } from './Stone';

type BeshTashBoardProps = {
  state: BeshTashGameState;
  isAttempting: boolean;
  liftProgress: SharedValue<number>;
  ringProgress: SharedValue<number>;
  sweetSpotFraction: number;
  onPressAction: () => void;
};

export function BeshTashBoard({
  state,
  isAttempting,
  liftProgress,
  ringProgress,
  sweetSpotFraction,
  onPressAction,
}: BeshTashBoardProps) {
  const { t } = useTranslation();
  const stage = BESH_TASH_STAGES[state.currentStageIndex];

  const groundStones = Array.from({ length: state.stonesOnGround });
  const heldStones = Array.from({ length: state.stonesHeld });

  return (
    <View style={styles.container}>
      <View style={styles.stageRow}>
        {BESH_TASH_STAGES.map((s, index) => (
          <View
            key={s.id}
            style={[
              styles.stageDot,
              index < state.currentStageIndex && styles.stageDotDone,
              index === state.currentStageIndex && styles.stageDotActive,
            ]}
          />
        ))}
      </View>

      <View style={styles.heldZone}>
        <Text style={styles.zoneLabel}>{t('beshTash.hand')}</Text>
        <View style={styles.stoneRow}>
          {heldStones.map((_, i) => (
            <Stone key={`held-${i}`} tone="held" liftProgress={liftProgress} />
          ))}
        </View>
      </View>

      <AnimatedPressable
        style={styles.actionArea}
        onPress={onPressAction}
        accessibilityRole="button"
        accessibilityLabel={isAttempting ? t('beshTash.catchNow') : t('beshTash.toss')}
      >
        <CatchRing progress={ringProgress} sweetSpotFraction={sweetSpotFraction} />
        <View style={styles.actionLabelWrap}>
          <Text style={styles.actionLabel}>
            {isAttempting ? t('beshTash.catchNow') : t('beshTash.toss')}
          </Text>
        </View>
      </AnimatedPressable>

      <View style={styles.groundZone}>
        <Text style={styles.zoneLabel}>{t('beshTash.ground')}</Text>
        <View style={styles.stoneRow}>
          {groundStones.map((_, i) => (
            <Stone
              key={`ground-${i}`}
              tone="ground"
              liftProgress={i === 0 && stage?.grabCount ? liftProgress : undefined}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
    alignItems: 'center',
  },
  stageRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  stageDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceAlt,
  },
  stageDotDone: {
    backgroundColor: colors.primaryMuted,
  },
  stageDotActive: {
    backgroundColor: colors.primary,
    width: 22,
  },
  heldZone: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.xs,
  },
  groundZone: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.xs,
  },
  zoneLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  stoneRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 90,
    alignItems: 'flex-end',
  },
  actionArea: {
    width: 96,
    height: 96,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadows.raised,
  },
  actionLabelWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  actionLabel: {
    ...typography.small,
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
