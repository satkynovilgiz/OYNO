import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { colors, radii, spacing, typography } from '@/theme';

type TutorialOverlayProps = {
  visible: boolean;
  /** Translation keys for each short step, shown one at a time. */
  stepKeys: string[];
  onDone: () => void;
};

/** Short interactive tutorial (Section 62) - a couple of lines per step,
 * never a full instructions page. */
export function TutorialOverlay({ visible, stepKeys, onDone }: TutorialOverlayProps) {
  const { t } = useTranslation();
  const [stepIndex, setStepIndex] = useState(0);

  if (!visible) return null;

  const isLastStep = stepIndex === stepKeys.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onDone();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.card}>
        <Text style={styles.step}>{t(stepKeys[stepIndex])}</Text>
        <View style={styles.actions}>
          <Pressable onPress={onDone} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('gameIntro.skip')}>
            <Text style={styles.skipLabel}>{t('gameIntro.skip')}</Text>
          </Pressable>
          <Button label={isLastStep ? t('gameIntro.start') : t('gameIntro.next')} onPress={handleNext} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: 'rgba(20,14,8,0.82)',
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  step: {
    ...typography.body,
    color: colors.textOnDark,
    textAlign: 'center',
  },
  skipLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
