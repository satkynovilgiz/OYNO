import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
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
import { colors, editorial, radii, spacing, textStyles } from '@/theme';

import { onboardingSlideImages, type OnboardingSlideImage } from './data';
import { DiscoverCollage, JourneyCollage, PlayCollage } from './OnboardingVisuals';

/** Reserved bottom space so each slide's own text never sits under the
 * fixed dots/CTA overlay (Section "reduce giant dead space" - the image
 * now fills the whole screen instead of stopping partway down, so the
 * chrome that used to live on its own cream footer now floats over the
 * art instead of pushing it up). */
const BOTTOM_CHROME_HEIGHT = 150;

type OnboardingScreenProps = {
  onFinish: () => void;
  onContinueAsGuest: () => void;
};

export function OnboardingScreen({ onFinish, onContinueAsGuest }: OnboardingScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const scrollRef = useRef<Animated.ScrollView>(null);
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const isLastSlide = index === onboardingSlideImages.length - 1;

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  // A tap sets `index` immediately (not waiting on onMomentumScrollEnd,
  // which doesn't reliably fire after a programmatic animated `scrollTo`
  // on web) so the button/pagination update at once for a normal, one-tap-
  // at-a-time press. `lastNavigationRef` guards against a second tap
  // landing before the previous `scrollTo` animation has had time to
  // settle, which would let `index` race ahead to a page the ScrollView
  // hadn't actually reached yet (the animation's own scrollTo calls can
  // override each other mid-flight). A real swipe still reconciles through
  // `handleMomentumScrollEnd` regardless.
  const lastNavigationRef = useRef(0);
  const goToIndex = (nextIndex: number) => {
    const now = Date.now();
    if (now - lastNavigationRef.current < 400) return;
    lastNavigationRef.current = now;
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
        style={styles.pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
      >
        {onboardingSlideImages.map((slide, slideIndex) => (
          <OnboardingSlide
            key={slide.id}
            slide={slide}
            slideIndex={slideIndex}
            scrollX={scrollX}
            screenWidth={screenWidth}
            screenHeight={screenHeight}
          />
        ))}
      </Animated.ScrollView>

      <View style={[styles.skipRow, { top: insets.top + spacing.sm }]}>
        <View style={styles.skipChip}>
          <TextButton label={t('onboarding.skip')} onPress={onFinish} tone="light" />
        </View>
      </View>

      <View style={[styles.bottomChrome, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.dots} accessible accessibilityRole="progressbar" accessibilityLabel={`${index + 1} / ${onboardingSlideImages.length}`}>
          {onboardingSlideImages.map((slide, dotIndex) => (
            <OnboardingDot key={slide.id} dotIndex={dotIndex} scrollX={scrollX} screenWidth={screenWidth} />
          ))}
        </View>

        <View style={styles.cta}>
          <Button label={isLastSlide ? t('onboarding.start') : t('onboarding.next')} variant="accent" size="lg" block onPress={handleContinue} />
        </View>
        {/* Guest-first stays one tap away on the last slide; account
            creation is never forced before the user has seen OYNO. */}
        {isLastSlide ? (
          <TextButton label={t('onboarding.v2.guest')} onPress={onContinueAsGuest} tone="light" style={styles.laterLink} />
        ) : (
          <View style={styles.laterSpacer} />
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
  screenHeight: number;
};

/** Content fades/rises in as its page becomes active and eases out toward
 * the neighbours (spec "subtle transitions between onboarding pages"),
 * driven by the shared horizontal scroll offset rather than the
 * momentum-end index so it tracks the finger during the swipe itself. */
function OnboardingSlide({ slide, slideIndex, scrollX, screenWidth, screenHeight }: OnboardingSlideProps) {
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
    <View style={[styles.slide, { width: screenWidth, height: screenHeight }]}>
      <Animated.Image
        source={slide.image}
        style={[StyleSheet.absoluteFill, styles.slideImage, imageStyle]}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(19,32,24,0.55)', 'rgba(19,32,24,0.4)', 'rgba(19,32,24,0.96)']}
        locations={[0, 0.5, 0.85]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.visual, { paddingTop: insets.top + 64 }]}>
        <Animated.View style={contentStyle}>
          {slide.id === 'discover' ? <DiscoverCollage width={Math.min(screenWidth - spacing.lg * 2, 420)} /> : null}
          {slide.id === 'play' ? <PlayCollage width={Math.min(screenWidth - spacing.lg * 2, 420)} /> : null}
          {slide.id === 'journey' ? <JourneyCollage width={Math.min(screenWidth - spacing.lg * 2, 420)} /> : null}
        </Animated.View>
      </View>

      <Animated.View style={[styles.content, { paddingBottom: BOTTOM_CHROME_HEIGHT + insets.bottom }, contentStyle]}>
        <Text style={styles.title} accessibilityRole="header">
          {t(`onboarding.v2.${slide.id}.title`)}
        </Text>
        <Text style={styles.description}>{t(`onboarding.v2.${slide.id}.description`)}</Text>
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
    backgroundColor: 'rgba(19,32,24,0.45)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  // The ScrollView's own viewport needs an explicit height on web - without
  // it, its cross-axis size is undefined, so a horizontal row of pages with
  // no independently-anchored height collapses toward its shortest in-flow
  // content (see `slide` below) instead of filling the screen.
  pager: {
    flex: 1,
  },
  // `flex: 1` here (RN Web -> CSS `flex-basis: 0%`) used to win over the
  // inline `width: screenWidth` on the ScrollView's main (horizontal) axis,
  // so each page got flex-distributed/shrunk instead of holding its full
  // page width - the total row still summed correctly, but individual
  // pages came out narrower than one viewport, exposing a strip of the
  // next slide at rest. `flexShrink: 0` keeps the explicit width
  // authoritative on the main axis. Height is now passed in explicitly too
  // (`useWindowDimensions().height`, alongside width) rather than relying
  // on cross-axis stretch: the slide's only in-flow child is its text
  // overlay (the image/gradient are position:absolute and don't contribute
  // to intrinsic size), so without an explicit height the box collapses to
  // that text block's height and the absolute-fill image resolves against
  // a mismatched ancestor instead of this slide.
  slide: {
    flexShrink: 0,
    justifyContent: 'flex-end',
    backgroundColor: colors.surfaceFeature,
    overflow: 'hidden',
  },
  // `StyleSheet.absoluteFill` alone (inset positioning only, no explicit
  // size) doesn't stretch an `Image` on web: per the CSS spec, an
  // absolutely-positioned *replaced element* (`<img>`) with 'auto'
  // width/height falls back to its intrinsic pixel size instead of filling
  // from insets the way a plain `View` does. Without this, the image
  // rendered at its native 941x1672 source resolution starting at the
  // slide's top-left corner instead of covering the full slide box - which
  // both left resizeMode="cover" unable to do its job and left a gap on
  // the right exposing the next slide underneath.
  slideImage: {
    width: '100%',
    height: '100%',
  },
  // Collage area: the upper part of the slide, above the copy.
  visual: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xs,
  },
  title: {
    ...editorial(textStyles.display),
    color: colors.textOnDark,
  },
  description: {
    ...textStyles.body,
    fontSize: 16,
    lineHeight: 23,
    color: colors.textOnDarkSecondary,
    maxWidth: 340,
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
  cta: {
    alignSelf: 'stretch',
  },
  laterLink: {
    paddingVertical: spacing.xxs,
  },
  // Same height as the guest link, so the CTA never jumps on the last slide.
  laterSpacer: {
    height: 30,
  },
});
