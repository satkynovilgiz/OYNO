import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { AnimatedPressable, Button } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';
import { getGameHostConfig } from '@games/gameHostCharacters';

import { CharacterAvatar } from './CharacterAvatar';

type GameIntroScreenProps = {
  gameId: string;
  /** Short "how to play" tip shown as the final beat before start, once per
   * game. Optional - if omitted, that beat is skipped. */
  howToPlayText?: string;
  onFinish: () => void;
};

type Step = { kind: 'line'; index: number } | { kind: 'howToPlay' };

/**
 * Shared pre-game intro: splash-in host character -> a couple of short
 * dialogue lines (emotion-matched portrait, tap to advance) -> optional
 * "Кантип ойнойт?" tip -> start. Always skippable.
 */
export function GameIntroScreen({ gameId, howToPlayText, onFinish }: GameIntroScreenProps) {
  const { t } = useTranslation();
  const host = getGameHostConfig(gameId);

  const lines = host?.lines ?? [];
  const [step, setStep] = useState<Step>({ kind: 'line', index: 0 });

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 220 });
    scale.value = withSpring(1, { damping: 14, stiffness: 180 });
  }, [step, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!host) {
    // No host configured for this game - nothing meaningful to show.
    onFinish();
    return null;
  }

  const advance = () => {
    opacity.value = withTiming(0, { duration: 120 });
    scale.value = withTiming(0.92, { duration: 120 });

    if (step.kind === 'line' && step.index < lines.length - 1) {
      setStep({ kind: 'line', index: step.index + 1 });
      return;
    }
    if (step.kind === 'line' && howToPlayText) {
      setStep({ kind: 'howToPlay' });
      return;
    }
    onFinish();
  };

  const currentLine = step.kind === 'line' ? lines[step.index] : null;
  const isLastBeat = step.kind === 'howToPlay' || (!howToPlayText && step.index === lines.length - 1);

  return (
    <View style={styles.root}>
      <View style={styles.skipRow}>
        <AnimatedPressable
          onPress={onFinish}
          accessibilityRole="button"
          accessibilityLabel={t('gameIntro.skip')}
          style={styles.skipButton}
        >
          <Text style={styles.skipLabel}>{t('gameIntro.skip')}</Text>
        </AnimatedPressable>
      </View>

      <View style={styles.center}>
        <Animated.View style={[styles.card, animatedStyle]}>
          <CharacterAvatar characterId={host.characterId} emotion={currentLine?.emotion ?? 'happy'} size={140} />

          <Text style={styles.name}>{t(`character.names.${host.characterId}`)}</Text>

          {step.kind === 'line' && currentLine ? (
            <Text style={styles.line}>{currentLine.text}</Text>
          ) : (
            <>
              <Text style={styles.howToPlayLabel}>{t('gameIntro.howToPlay')}</Text>
              <Text style={styles.line}>{howToPlayText}</Text>
            </>
          )}
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <Button label={isLastBeat ? t('gameIntro.start') : t('gameIntro.next')} onPress={advance} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
  },
  skipRow: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  skipButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  skipLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    width: '100%',
  },
  name: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  howToPlayLabel: {
    ...typography.overline,
    color: colors.primary,
  },
  line: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
});
