import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
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
import { colors, radii, spacing, typography } from '@/theme';
import wordmark from '@assets/img/OYNO_design/wordmark.png';

import { onboardingSlideImages, type OnboardingSlideImage } from './data';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type OnboardingScreenProps = {
  onFinish: () => void;
  onContinueAsGuest: () => void;
};

export function OnboardingScreen({ onFinish, onContinueAsGuest }: OnboardingScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<Animated.ScrollView>(null);
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const isLastSlide = index === onboardingSlideImages.length - 1;

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  const goToIndex = (nextIndex: number) => {
    scrollRef.current?.scrollTo({ x: nextIndex * SCREEN_WIDTH, animated: true });
    setIndex(nextIndex);
  };

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
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
      <View style={[styles.skipRow, { top: insets.top + spacing.sm }]}>
        <View style={styles.skipChip}>
          <TextButton label={t('onboarding.skip')} onPress={onFinish} />
        </View>
      </View>

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
          <OnboardingSlide key={slide.id} slide={slide} slideIndex={slideIndex} scrollX={scrollX} />
        ))}
      </Animated.ScrollView>

      <View style={styles.dots}>
        {onboardingSlideImages.map((slide, dotIndex) => (
          <OnboardingDot key={slide.id} dotIndex={dotIndex} scrollX={scrollX} />
        ))}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {isLastSlide ? (
          <>
            <Button label={t('onboarding.start')} onPress={handleContinue} />
            <TextButton label={t('onboarding.later')} onPress={onContinueAsGuest} tone="muted" />
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
};

/** Content fades/rises in as its page becomes active and eases out toward
 * the neighbours (spec "subtle transitions between onboarding pages"),
 * driven by the shared horizontal scroll offset rather than the
 * momentum-end index so it tracks the finger during the swipe itself. */
function OnboardingSlide({ slide, slideIndex, scrollX }: OnboardingSlideProps) {
  const { t } = useTranslation();
  const inputRange = [(slideIndex - 1) * SCREEN_WIDTH, slideIndex * SCREEN_WIDTH, (slideIndex + 1) * SCREEN_WIDTH];

  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollX.value, inputRange, [14, 0, 14], Extrapolation.CLAMP) }],
  }));

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(scrollX.value, inputRange, [1.1, 1, 1.1], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      <View style={styles.imageWrap}>
        <Animated.Image source={slide.image} style={[styles.image, imageStyle]} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(20,14,8,0)', colors.background]}
          locations={[0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        {slide.id === 'welcome' ? (
          <View style={styles.wordmarkBadge}>
            <Image source={wordmark} style={styles.wordmarkImage} resizeMode="contain" />
          </View>
        ) : null}
      </View>

      <Animated.View style={[styles.textBlock, contentStyle]}>
        <View style={styles.ornamentRow}>
          <OymoOrnament size={12} color={colors.accentGold} />
          <OymoOrnament size={14} color={colors.accentGold} />
          <OymoOrnament size={12} color={colors.accentGold} />
        </View>
        <Text style={styles.title}>{t(`onboarding.slides.${slide.id}.title`)}</Text>
        <Text style={styles.description}>{t(`onboarding.slides.${slide.id}.description`)}</Text>
      </Animated.View>
    </View>
  );
}

function OnboardingDot({ dotIndex, scrollX }: { dotIndex: number; scrollX: SharedValue<number> }) {
  const inputRange = [(dotIndex - 1) * SCREEN_WIDTH, dotIndex * SCREEN_WIDTH, (dotIndex + 1) * SCREEN_WIDTH];

  const dotStyle = useAnimatedStyle(() => ({
    width: interpolate(scrollX.value, inputRange, [8, 24, 8], Extrapolation.CLAMP),
    opacity: interpolate(scrollX.value, inputRange, [0.45, 1, 0.45], Extrapolation.CLAMP),
  }));

  return <Animated.View style={[styles.dot, dotStyle]} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skipRow: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 1,
  },
  skipChip: {
    backgroundColor: 'rgba(251,243,227,0.88)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  slide: {
    flex: 1,
  },
  imageWrap: {
    width: '100%',
    height: '56%',
    backgroundColor: colors.surfaceAlt,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  wordmarkBadge: {
    position: 'absolute',
    top: '18%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  wordmarkImage: {
    width: 176,
    height: 48,
  },
  textBlock: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    alignItems: 'center',
    gap: spacing.sm,
  },
  ornamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.display,
    color: colors.primary,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  dot: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.accentGold,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },
});
