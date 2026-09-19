import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { Button, TextButton } from '@/components/ui';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { colors, radii, spacing, typography } from '@/theme';
import wordmark from '@assets/img/OYNO_design/wordmark.png';

import { onboardingSlideImages, type OnboardingSlideImage } from './data';

/** Reserved bottom space so each slide's own text never sits under the
 * fixed dots/CTA overlay (Section "reduce giant dead space" - the image
 * now fills the whole screen instead of stopping partway down, so the
 * chrome that used to live on its own cream footer now floats over the
 * art instead of pushing it up). */
const BOTTOM_CHROME_HEIGHT = 168;

type OnboardingScreenProps = {
  onFinish: () => void;
  onContinueAsGuest: () => void;
};

export function OnboardingScreen({ onFinish, onContinueAsGuest }: OnboardingScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const scrollRef = useRef<Animated.ScrollView>(null);
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const isLastSlide = index === onboardingSlideImages.length - 1;

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  const goToIndex = (nextIndex: number) => {
    scrollRef.current?.scrollTo({ x: nextIndex * screenWidth, animated: true });
    setIndex(nextIndex);
  };

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    setIndex(nextIndex);
  };

  const handleContinue = () => {
    if (isLastSlide) {
      onFinish();
    } else {
      goToIndex(index + 1);
    }
  };

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
      >
        {onboardingSlideImages.map((slide, slideIndex) => (
          <OnboardingSlide key={slide.id} slide={slide} slideIndex={slideIndex} scrollX={scrollX} screenWidth={screenWidth} />
        ))}
      </Animated.ScrollView>

      <View style={[styles.skipRow, { top: insets.top + spacing.sm }]}>
        <View style={styles.skipChip}>
          <TextButton label={t('onboarding.skip')} onPress={onFinish} />
        </View>
      </View>

      <View style={[styles.bottomChrome, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.dots}>
          {onboardingSlideImages.map((slide, dotIndex) => (
            <OnboardingDot key={slide.id} dotIndex={dotIndex} scrollX={scrollX} screenWidth={screenWidth} />
          ))}
        </View>

        {isLastSlide ? (
          <>
            <Button label={t('onboarding.start')} onPress={handleContinue} />
            <TextButton label={t('onboarding.later')} onPress={onContinueAsGuest} tone="light" style={styles.laterLink} />
          </>
        ) : (
          <Button label={t('onboarding.next')} onPress={handleContinue} />
        )}
      </View>
    </View>
  );
}

type OnboardingSlideProps = {
  slide: OnboardingSlideImage;
  slideIndex: number;
  scrollX: SharedValue<number>;
  screenWidth: number;
};

/** Content fades/rises in as its page becomes active and eases out toward
 * the neighbours (spec "subtle transitions between onboarding pages"),
 * driven by the shared horizontal scroll offset rather than the
 * momentum-end index so it tracks the finger during the swipe itself. */
function OnboardingSlide({ slide, slideIndex, scrollX, screenWidth }: OnboardingSlideProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const inputRange = [(slideIndex - 1) * screenWidth, slideIndex * screenWidth, (slideIndex + 1) * screenWidth];

  // Reduce Motion: content stays fully visible in place and the image
  // stays at rest scale - the actual paging (a direct, user-driven swipe)
  // is untouched, only the decorative fade/rise/parallax is skipped.
  const contentStyle = useAnimatedStyle(() => {
    if (reducedMotion) return { opacity: 1, transform: [{ translateY: 0 }] };
    return {
      opacity: interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(scrollX.value, inputRange, [14, 0, 14], Extrapolation.CLAMP) }],
    };
  });

  const imageStyle = useAnimatedStyle(() => {
    if (reducedMotion) return { transform: [{ scale: 1 }] };
    return { transform: [{ scale: interpolate(scrollX.value, inputRange, [1.1, 1, 1.1], Extrapolation.CLAMP) }] };
  });

  return (
    <View style={[styles.slide, { width: screenWidth }]}>
      <Animated.Image source={slide.image} style={[StyleSheet.absoluteFill, imageStyle]} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(19,32,24,0)', 'rgba(19,32,24,0.25)', 'rgba(19,32,24,0.94)']}
        locations={[0.35, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />

      {slide.id === 'welcome' ? (
        <View style={[styles.wordmarkBadge, { top: insets.top + spacing.xxl }]}>
          <Image source={wordmark} style={styles.wordmarkImage} resizeMode="contain" />
        </View>
      ) : null}

      <Animated.View style={[styles.content, { paddingBottom: BOTTOM_CHROME_HEIGHT + insets.bottom }, contentStyle]}>
        <View style={styles.ornamentRow}>
          <OymoOrnament size={11} color={colors.accentGold} />
          <OymoOrnament size={13} color={colors.accentGold} />
          <OymoOrnament size={11} color={colors.accentGold} />
        </View>
        <Text style={styles.title}>{t(`onboarding.slides.${slide.id}.title`)}</Text>
        <Text style={styles.description}>{t(`onboarding.slides.${slide.id}.description`)}</Text>
      </Animated.View>
    </View>
  );
}

function OnboardingDot({ dotIndex, scrollX, screenWidth }: { dotIndex: number; scrollX: SharedValue<number>; screenWidth: number }) {
  const inputRange = [(dotIndex - 1) * screenWidth, dotIndex * screenWidth, (dotIndex + 1) * screenWidth];

  const dotStyle = useAnimatedStyle(() => ({
    width: interpolate(scrollX.value, inputRange, [8, 24, 8], Extrapolation.CLAMP),
    opacity: interpolate(scrollX.value, inputRange, [0.45, 1, 0.45], Extrapolation.CLAMP),
  }));

  return <Animated.View style={[styles.dot, dotStyle]} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfaceFeature,
  },
  skipRow: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 1,
  },
  skipChip: {
    backgroundColor: 'rgba(251,243,227,0.9)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  slide: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.surfaceFeature,
  },
  wordmarkBadge: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
  },
  wordmarkImage: {
    width: 176,
    height: 48,
  },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xs,
  },
  ornamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.display,
    fontSize: 26,
    color: colors.textOnDark,
  },
  description: {
    ...typography.body,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 21,
    maxWidth: 320,
  },
  bottomChrome: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  dot: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.accentGold,
  },
  laterLink: {
    paddingVertical: spacing.xxs,
  },
});
