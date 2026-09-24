import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radii, spacing, typography } from '@/theme';

import { HudButton } from './HudButton';
import { HUD, useHudScale } from './hudTheme';

type TutorialOverlayProps = {
  visible: boolean;
  /** Translation keys for each short step (the game's REAL controls). */
  stepKeys: string[];
  onDone: () => void;
};

/**
 * First-time hints (1-4 short steps) at the bottom of the screen, so the
 * scene above stays visible. Step dots + "2 / 3" show how short it is,
 * Skip is always available. Each game persists completion per game
 * (core/tutorialStorage) - returning players aren't shown it again unless
 * they ask via Pause -> How to play.
 */
export function TutorialOverlay({ visible, stepKeys, onDone }: TutorialOverlayProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const scale = useHudScale();
  const [stepIndex, setStepIndex] = useState(0);

  if (!visible) return null;

  const isLastStep = stepIndex === stepKeys.length - 1;
  const next = () => (isLastStep ? onDone() : setStepIndex((index) => index + 1));

  return (
    <View
      style={[styles.root, { paddingBottom: insets.bottom + spacing.lg, paddingLeft: insets.left + spacing.lg, paddingRight: insets.right + spacing.lg }]}
      pointerEvents="box-none"
    >
      <View style={styles.card} accessibilityLiveRegion="polite">
        <View style={styles.progress} accessible accessibilityLabel={t('games3d.tutorial.step', { current: stepIndex + 1, total: stepKeys.length })}>
          {stepKeys.map((key, index) => (
            <View key={key} style={[styles.dot, index === stepIndex && styles.dotActive, index < stepIndex && styles.dotDone]} />
          ))}
          <Text style={styles.counter}>{t('games3d.tutorial.step', { current: stepIndex + 1, total: stepKeys.length })}</Text>
        </View>
        <Text style={[styles.step, { fontSize: scale.value + 1, lineHeight: scale.value + 7 }]}>{t(stepKeys[stepIndex])}</Text>
        <View style={styles.actions}>
          <HudButton label={t('gameIntro.skip')} variant="quiet" onPress={onDone} />
          <View style={styles.primary}>
            <HudButton label={isLastStep ? t('gameIntro.start') : t('gameIntro.next')} variant="primary" onPress={next} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'flex-end' },
  card: { width: '100%', maxWidth: 460, backgroundColor: HUD.surfaceStrong, borderRadius: radii.xl, borderWidth: 1, borderColor: HUD.border, padding: spacing.md, gap: spacing.sm },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(251,243,227,0.25)' },
  dotActive: { width: 20, backgroundColor: HUD.gold },
  dotDone: { backgroundColor: 'rgba(232,185,61,0.55)' },
  counter: { ...typography.small, fontWeight: '700', color: HUD.textMuted, marginLeft: 'auto' },
  step: { ...typography.bodyBold, color: HUD.text, textAlign: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  primary: { flex: 1, maxWidth: 220 },
});
