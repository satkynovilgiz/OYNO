import { useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

import { onboardingSlides } from './data';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type OnboardingScreenProps = {
  onFinish: () => void;
  onContinueAsGuest: () => void;
};

export function OnboardingScreen({ onFinish, onContinueAsGuest }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const isLastSlide = index === onboardingSlides.length - 1;

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
      <View style={[styles.skipRow, { paddingTop: insets.top + spacing.sm }]}>
        <AnimatedPressable
          onPress={onFinish}
          accessibilityRole="button"
          accessibilityLabel="Өткөрүп жиберүү"
          style={styles.skipButton}
        >
          <Text style={styles.skipLabel}>Өткөрүп жиберүү</Text>
        </AnimatedPressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
      >
        {onboardingSlides.map((slide) => (
          <View key={slide.id} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View style={styles.imageWrap}>
              <Image source={slide.image} style={styles.image} resizeMode="cover" />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.description}>{slide.description}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {onboardingSlides.map((slide, dotIndex) => (
          <View key={slide.id} style={[styles.dot, dotIndex === index && styles.dotActive]} />
        ))}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {isLastSlide ? (
          <>
            <Button label="Баштоо" onPress={handleContinue} />
            <AnimatedPressable
              onPress={onContinueAsGuest}
              accessibilityRole="button"
              accessibilityLabel="Кийинчерээк"
              style={styles.laterButton}
            >
              <Text style={styles.laterLabel}>Кийинчерээк</Text>
            </AnimatedPressable>
          </>
        ) : (
          <Button label="Улантуу" onPress={handleContinue} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skipRow: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
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
  slide: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1.1,
    borderRadius: radii.xxl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  image: {
    width: '100%',
    height: '100%',
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
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginVertical: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceBorder,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 22,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },
  laterButton: {
    paddingVertical: spacing.xs,
  },
  laterLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
});
