import * as Haptics from 'expo-haptics';
import { Check, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable } from '@/components/ui';
import type { DailyChallengeOption } from '@/services/daily/dailyDiscovery';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { colors, radii, spacing, typography } from '@/theme';

type OptionState = 'idle' | 'wrong' | 'correct' | 'dimmed';

type DailyImageChallengeProps = {
  title: string;
  options: DailyChallengeOption[];
  imageOf: (itemId: string) => ImageSourcePropType | undefined;
  /** `stack`: full-width picture choices, one per row (child/preteen - big
   * targets, nothing to squint at). `row`: three tall portrait choices side
   * by side (teen - quicker, more "spot it" than "pick one"). */
  layout: 'stack' | 'row';
  onSolved: () => void;
};

/**
 * "Which picture shows X?" - the Daily challenge as a picture-first OYNO
 * moment rather than a quiz box. Nothing about the choices hints at the
 * answer until one is tapped. A wrong pick softly dims with a terracotta
 * edge and a small shake (not a red error); the right pick springs up with
 * a gold ring and the other photos quietly fade back. Motion is skipped
 * under Reduce Motion; haptics follow the same restrained rules as
 * CompletionSheet (one success tap, one light tap on a miss).
 */
export function DailyImageChallenge({ title, options, imageOf, layout, onSolved }: DailyImageChallengeProps) {
  const { t } = useTranslation();
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [solvedId, setSolvedId] = useState<string | null>(null);

  function handlePress(option: DailyChallengeOption) {
    if (solvedId || wrongIds.includes(option.itemId)) return;
    if (option.correct) {
      setSolvedId(option.itemId);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSolved();
    } else {
      setWrongIds([...wrongIds, option.itemId]);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }

  function stateFor(option: DailyChallengeOption): OptionState {
    if (solvedId) return option.itemId === solvedId ? 'correct' : 'dimmed';
    return wrongIds.includes(option.itemId) ? 'wrong' : 'idle';
  }

  return (
    <View style={styles.root}>
      <View style={styles.eyebrowRow}>
        <OymoOrnament size={11} color={colors.accentTerracotta} strokeWidth={1.75} />
        <Text style={styles.eyebrow}>{t('daily.challenge.eyebrow')}</Text>
      </View>
      <Text style={styles.question}>{t('daily.challenge.question', { title })}</Text>

      <View style={layout === 'stack' ? styles.stack : styles.row}>
        {options.map((option, index) => {
          const image = imageOf(option.itemId);
          if (!image) return null;
          return (
            <ChallengeOption
              key={option.itemId}
              image={image}
              state={stateFor(option)}
              layout={layout}
              accessibilityLabel={t('daily.challenge.optionLabel', { index: index + 1 })}
              onPress={() => handlePress(option)}
            />
          );
        })}
      </View>

      <Text style={[styles.feedback, solvedId ? styles.feedbackRight : null]} accessibilityLiveRegion="polite">
        {solvedId ? t('daily.challenge.correct') : wrongIds.length > 0 ? t('daily.challenge.tryAgain') : ' '}
      </Text>
    </View>
  );
}

type ChallengeOptionProps = {
  image: ImageSourcePropType;
  state: OptionState;
  layout: 'stack' | 'row';
  accessibilityLabel: string;
  onPress: () => void;
};

function ChallengeOption({ image, state, layout, accessibilityLabel, onPress }: ChallengeOptionProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const shift = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    if (state === 'correct') {
      fade.value = 1;
      if (!reducedMotion) scale.value = withSequence(withSpring(1.04, { damping: 9, stiffness: 220 }), withSpring(1, { damping: 14 }));
    } else if (state === 'wrong') {
      fade.value = reducedMotion ? 0.5 : withTiming(0.5, { duration: 220 });
      if (!reducedMotion) shift.value = withSequence(withTiming(-6, { duration: 60 }), withTiming(6, { duration: 60 }), withTiming(-3, { duration: 60 }), withTiming(0, { duration: 60 }));
    } else if (state === 'dimmed') {
      fade.value = reducedMotion ? 0.35 : withTiming(0.35, { duration: 260 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateX: shift.value }, { scale: scale.value }],
  }));

  const disabled = state !== 'idle';

  return (
    <Animated.View style={[layout === 'stack' ? styles.optionStack : styles.optionRow, animatedStyle]}>
      <AnimatedPressable
        style={[styles.option, state === 'correct' && styles.optionCorrect, state === 'wrong' && styles.optionWrong]}
        onPress={onPress}
        disabled={disabled}
        pressScale={0.97}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled, selected: state === 'correct' }}
      >
        <Image source={image} style={styles.optionImage} resizeMode="cover" />
        {state === 'correct' ? (
          <View style={[styles.badge, styles.badgeCorrect]}>
            <Check size={18} color={colors.textPrimary} strokeWidth={3} />
          </View>
        ) : state === 'wrong' ? (
          <View style={[styles.badge, styles.badgeWrong]}>
            <X size={16} color={colors.textOnDark} strokeWidth={2.75} />
          </View>
        ) : null}
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  eyebrow: {
    ...typography.overline,
    color: colors.accentTerracotta,
  },
  question: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  stack: {
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
  optionStack: {
    width: '100%',
    aspectRatio: 2,
  },
  optionRow: {
    flex: 1,
    aspectRatio: 3 / 4,
  },
  option: {
    flex: 1,
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceAlt,
  },
  optionCorrect: {
    borderColor: colors.accentGold,
  },
  optionWrong: {
    borderColor: colors.accentTerracotta,
  },
  optionImage: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCorrect: {
    backgroundColor: colors.accentGold,
  },
  badgeWrong: {
    backgroundColor: colors.accentTerracotta,
  },
  feedback: {
    ...typography.body,
    color: colors.textSecondary,
    minHeight: 22,
  },
  feedbackRight: {
    color: colors.primary,
    fontWeight: '700',
  },
});
