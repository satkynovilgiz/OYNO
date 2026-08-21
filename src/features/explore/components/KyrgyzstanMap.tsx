import { LinearGradient } from 'expo-linear-gradient';
import { Crosshair, Filter, Mountain } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { IconButton } from '@/components/ui';
import { colors, radii, spacing } from '@/theme';

import type { MapPinVariant } from '../types';
import { MapPin } from './MapPin';

export type KyrgyzstanMapPin = {
  id: string;
  label: string;
  xPercent: number;
  yPercent: number;
  color: string;
  variant: MapPinVariant;
};

type KyrgyzstanMapProps = {
  pins: KyrgyzstanMapPin[];
  onPressPin?: (locationId: string) => void;
  onPressLocate?: () => void;
  onPressFilter?: () => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 3;

/**
 * Interactive map card: pinch-to-zoom/pan over a stylized Kyrgyzstan
 * terrain illustration, with location pins overlaid. There's no real map
 * illustration asset yet (spec: "static illustration asset for now") - the
 * gradient + watermark mountain icon below is a placeholder background,
 * not final art, sized to swap a real <Image> in later.
 */
export function KyrgyzstanMap({ pins, onPressPin, onPressLocate, onPressFilter }: KyrgyzstanMapProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const next = savedScale.value * event.scale;
      scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const recenter = () => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    savedTranslateX.value = 0;
    translateY.value = withTiming(0);
    savedTranslateY.value = 0;
  };

  return (
    <View style={styles.card}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.surface, contentStyle]}>
          <LinearGradient
            colors={['#4A8C6F', '#3D6E72', '#2F5233']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.watermark}>
            <Mountain size={140} color="rgba(255,255,255,0.14)" strokeWidth={1.25} />
          </View>

          {pins.map((pin) => {
            const halfWidth = pin.variant === 'landmark' ? 19 : 15;
            return (
              <View
                key={pin.id}
                style={[
                  styles.pinAnchor,
                  { left: `${pin.xPercent}%`, top: `${pin.yPercent}%`, transform: [{ translateX: -halfWidth }] },
                ]}
              >
                <MapPin
                  label={pin.label}
                  color={pin.color}
                  variant={pin.variant}
                  onPress={() => onPressPin?.(pin.id)}
                />
              </View>
            );
          })}
        </Animated.View>
      </GestureDetector>

      <View style={styles.actions}>
        <IconButton
          icon={Crosshair}
          accessibilityLabel="Ортого келтирүү"
          onPress={() => {
            recenter();
            onPressLocate?.();
          }}
        />
        <IconButton icon={Filter} accessibilityLabel="Чыпкалоо" onPress={onPressFilter} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 1.4,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.tiles.map,
  },
  surface: {
    flex: 1,
  },
  watermark: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinAnchor: {
    position: 'absolute',
  },
  actions: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    gap: spacing.xs,
  },
});
