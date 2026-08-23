import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

import { Button, TextButton } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

import { onboardingSlideImages } from './data';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type OnboardingScreenProps = {
  onFinish: () => void;
  onContinueAsGuest: () => void;
};

export function OnboardingScreen({ onFinish, onContinueAsGuest }: OnboardingScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const isLastSlide = index === onboardingSlideImages.length - 1;

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
        <TextButton label={t('onboarding.skip')} onPress={onFinish} tone="muted" />
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
      >
        {onboardingSlideImages.map((slide) => (
          <View key={slide.id} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View style={styles.imageWrap}>
              <Image source={slide.image} style={styles.image} resizeMode="cover" />
            </View>
            <Text style={styles.title}>{t(`onboarding.slides.${slide.id}.title`)}</Text>
            <Text style={styles.description}>{t(`onboarding.slides.${slide.id}.description`)}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {onboardingSlideImages.map((slide, dotIndex) => (
          <View key={slide.id} style={[styles.dot, dotIndex === index && styles.dotActive]} />
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skipRow: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
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
});
