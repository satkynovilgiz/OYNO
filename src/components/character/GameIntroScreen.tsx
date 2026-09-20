import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { AnimatedPressable, Button } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { hasSeenGameIntro, markGameIntroSeen } from '@/services/ageExperience/gameIntroSeen';
import { resolveGameIntroPresentation } from '@/services/ageExperience/guideCharacterGating';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, radii, spacing, typography } from '@/theme';
import { getGameHostConfig, type GameIntroLine } from '@games/gameHostCharacters';

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
 *
 * How much of this plays adapts by AgeExperience (spec "Make OYNO guide
 * characters age-aware... prominence adapts"): child always gets the full
 * beat sequence; preteen gets it once per game then steps back; teen/adult
 * get a single condensed line the first time only - see
 * guideCharacterGating.ts. The host character and its dialogue lines
 * themselves never change by age (never made to sound childish or
 * different per age), only how often/how much of it plays.
 */
function lineText(line: GameIntroLine, language: SupportedLanguage): string {
  return line.text[language] ?? line.text.kg;
}

export function GameIntroScreen({ gameId, howToPlayText, onFinish }: GameIntroScreenProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const { config } = useAgeExperience();
  const host = getGameHostConfig(gameId);
  const [presentation, setPresentation] = useState<'full' | 'condensed' | 'skip' | 'loading'>('loading');

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

  useEffect(() => {
    if (!host) return;
    let cancelled = false;
    hasSeenGameIntro(gameId).then((hasSeenBefore) => {
      if (!cancelled) setPresentation(resolveGameIntroPresentation(config.characterProminence, hasSeenBefore));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, host, config.characterProminence]);

  if (!host) {
    // No host configured for this game - nothing meaningful to show.
    onFinish();
    return null;
  }

  if (presentation === 'loading') {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (presentation === 'skip') {
    onFinish();
    return null;
  }

  const finish = () => {
    void markGameIntroSeen(gameId);
    onFinish();
  };

  if (presentation === 'condensed') {
    const line = lines[0];
    return (
      <View style={styles.root}>
        <View style={styles.skipRow}>
          <AnimatedPressable onPress={finish} accessibilityRole="button" accessibilityLabel={t('gameIntro.skip')} style={styles.skipButton}>
            <Text style={styles.skipLabel}>{t('gameIntro.skip')}</Text>
          </AnimatedPressable>
        </View>
        <View style={styles.center}>
          <View style={styles.condensedCard}>
            <CharacterAvatar characterId={host.characterId} emotion={line?.emotion ?? 'happy'} size={72} />
            <View style={styles.condensedText}>
              <Text style={styles.condensedName}>{t(`character.names.${host.characterId}`)}</Text>
              {line ? (
                <Text style={styles.condensedLine} numberOfLines={2}>
                  {lineText(line, language)}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
        <View style={styles.footer}>
          <Button label={t('gameIntro.start')} onPress={finish} />
        </View>
      </View>
    );
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
    finish();
  };

  const currentLine = step.kind === 'line' ? lines[step.index] : null;
  const isLastBeat = step.kind === 'howToPlay' || (!howToPlayText && step.index === lines.length - 1);

  return (
    <View style={styles.root}>
      <View style={styles.skipRow}>
        <AnimatedPressable
          onPress={finish}
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
            <Text style={styles.line}>{lineText(currentLine, language)}</Text>
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
  condensedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    width: '100%',
  },
  condensedText: {
    flex: 1,
    gap: 2,
  },
  condensedName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  condensedLine: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
});
