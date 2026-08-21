import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { radii } from '@/theme';
import mapTerrain from '@assets/img/OYNO_design/explore/map_terrain.png';

export type KyrgyzstanMapPin = {
  id: string;
  label: string;
  xPercent: number;
  yPercent: number;
};

type KyrgyzstanMapProps = {
  pins: KyrgyzstanMapPin[];
  onPressPin?: (locationId: string) => void;
  onPressLocate?: () => void;
  onPressFilter?: () => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 3;

// map_terrain.png is sliced straight from the design reference (docs:
// "Explore Kyrgyzstan Learning Map.png") - it already has pins, labels, and
// the locate/filter buttons painted in, so this renders that art as-is and
// overlays invisible, accessible tap targets at the same coordinates rather
// than drawing a second set of pins/buttons on top of the baked ones. Once
// a clean pin-free map illustration exists, swap this for a background-only
// image and restore visible MapPin markers (component kept in this folder,
// unused here, for exactly that).
const TAP_TARGET_SIZE = { width: 15, height: 14 }; // percent of card

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
    .minDistance(10)
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
          <Image
            source={mapTerrain}
            style={[StyleSheet.absoluteFill, styles.terrainImage]}
            resizeMode="cover"
          />

          {pins.map((pin) => (
            <View
              key={pin.id}
              style={[
                styles.tapTargetWrap,
                {
                  left: `${pin.xPercent - TAP_TARGET_SIZE.width / 2}%`,
                  top: `${pin.yPercent - TAP_TARGET_SIZE.height / 2}%`,
                  width: `${TAP_TARGET_SIZE.width}%`,
                  height: `${TAP_TARGET_SIZE.height}%`,
                },
              ]}
            >
              <Pressable
                onPress={() => onPressPin?.(pin.id)}
                accessibilityRole="button"
                accessibilityLabel={pin.label}
                style={styles.tapTargetFill}
              />
            </View>
          ))}

          <View style={[styles.tapTargetWrap, styles.locateTarget]}>
            <Pressable
              onPress={() => {
                recenter();
                onPressLocate?.();
              }}
              accessibilityRole="button"
              accessibilityLabel="Ортого келтирүү"
              style={styles.tapTargetFill}
            />
          </View>
          <View style={[styles.tapTargetWrap, styles.filterTarget]}>
            <Pressable
              onPress={onPressFilter}
              accessibilityRole="button"
              accessibilityLabel="Чыпкалоо"
              style={styles.tapTargetFill}
            />
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 819 / 544,
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  surface: {
    flex: 1,
  },
  terrainImage: {
    width: '100%',
    height: '100%',
  },
  tapTargetWrap: {
    position: 'absolute',
  },
  tapTargetFill: {
    flex: 1,
  },
  locateTarget: {
    left: '88%',
    top: '73%',
    width: '11%',
    height: '13%',
  },
  filterTarget: {
    left: '88%',
    top: '86%',
    width: '11%',
    height: '13%',
  },
});
