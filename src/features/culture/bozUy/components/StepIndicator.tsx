import { Check } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, typography } from '@/theme';

type StepIndicatorProps = {
  stepCount: number;
  currentStepIndex: number;
};

/** Solid connector segments up through the current step, dashed for the
 * rest - a clearer "progress so far" read than a uniform dashed line (per
 * the detailed Boz Üy reference). */
export function StepIndicator({ stepCount, currentStepIndex }: StepIndicatorProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: stepCount }, (_, index) => {
        const isCompleted = index < currentStepIndex;
        const isCurrent = index === currentStepIndex;
        const connectorCompleted = index < currentStepIndex;

        return (
          <View key={index} style={styles.segment}>
            <View
              style={[
                styles.dot,
                isCompleted && styles.dotCompleted,
                isCurrent && styles.dotCurrent,
              ]}
            >
              {isCompleted ? (
                <Check size={13} color={colors.textOnPrimary} strokeWidth={3} />
              ) : (
                <Text style={[styles.dotLabel, isCurrent && styles.dotLabelCurrent]}>{index + 1}</Text>
              )}
            </View>
            {index < stepCount - 1 ? (
              <View style={[styles.connector, connectorCompleted ? styles.connectorSolid : styles.connectorDashed]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const DOT_SIZE = 28;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
  },
  dotCompleted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dotCurrent: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  dotLabel: {
    ...typography.small,
    color: colors.textMuted,
    fontWeight: '700',
  },
  dotLabelCurrent: {
    color: colors.primary,
  },
  connector: {
    flex: 1,
    height: 2,
    marginHorizontal: 2,
    borderRadius: radii.sm,
  },
  connectorSolid: {
    backgroundColor: colors.primary,
  },
  connectorDashed: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.surfaceBorder,
  },
});
