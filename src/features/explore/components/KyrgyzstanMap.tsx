import { Filter, Locate } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { IconButton } from '@/components/ui/IconButton';
import type { RegionState } from '@/services/explore/regionState';
import { colors, radii, shadows } from '@/theme';

import { ILLUSTRATED_MAP_ASPECT, ILLUSTRATED_MAP_IMAGE, panLimits } from '../map/illustratedMap';
import type { MapPinVariant } from '../types';
import { MapPin } from './MapPin';
import { RegionStateBadge } from './RegionStateBadge';

export type KyrgyzstanMapPin = {
  id: string;
  label: string;
  /** Position on the illustrated atlas (ILLUSTRATED_MAP_COORDINATES). */
  xPercent: number;
  yPercent: number;
  color: string;
  variant: MapPinVariant;
  state?: RegionState;
};

type KyrgyzstanMapProps = {
  pins: KyrgyzstanMapPin[];
  onPressPin?: (locationId: string) => void;
  onPressLocate?: () => void;
  onPressFilter?: () => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 3;
const CARD_ASPECT = 1.35;
const PIN_BOX_WIDTH = 40;

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

/**
 * Explore's compact map preview: the OYNO illustrated atlas
 * (illustratedMap.ts) as background art, with real, visible pins for the
 * Explore regions on top. Pins and art live on one transformed surface, so
 * they pan and pinch together; pins keep their size while zooming. The art
 * box keeps the painting's own 4:3 aspect inside the 1.35:1 card, so the
 * whole country - Batken to Issyk-Kul - is in view at rest, with only
 * ~0.6% trimmed top and bottom. Pan is clamped to the zoomed overflow, so
 * the map can never be dragged away.
 */
export function KyrgyzstanMap({ pins, onPressPin, onPressLocate, onPressFilter }: KyrgyzstanMapProps) {
  const { t } = useTranslation();
  const [cardWidth, setCardWidth] = useState(0);
  const artHeight = cardWidth / ILLUSTRATED_MAP_ASPECT;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const size = useSharedValue({ w: 0, h: 0, cardH: 0 });

  function onLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setCardWidth(width);
    size.value = { w: width, h: width / ILLUSTRATED_MAP_ASPECT, cardH: height };
  }

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = clamp(savedScale.value * event.scale, MIN_SCALE, MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      // Zooming out can leave the map past its new limits - settle it back.
      const { maxX, maxY } = panLimits(size.value.w, size.value.h, size.value.w, size.value.cardH, scale.value);
      savedTranslateX.value = clamp(translateX.value, -maxX, maxX);
      savedTranslateY.value = clamp(translateY.value, -maxY, maxY);
      translateX.value = withTiming(savedTranslateX.value);
      translateY.value = withTiming(savedTranslateY.value);
    });

  const panGesture = Gesture.Pan()
    .minDistance(10)
    .onUpdate((event) => {
      const { maxX, maxY } = panLimits(size.value.w, size.value.h, size.value.w, size.value.cardH, scale.value);
      translateX.value = clamp(savedTranslateX.value + event.translationX, -maxX, maxX);
      translateY.value = clamp(savedTranslateY.value + event.translationY, -maxY, maxY);
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
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
    // Shadow and corner-clipping live on separate layers (a view drops its
    // own shadow on iOS once it also clips content via overflow) - same
    // split HeroBanner.tsx uses.
    <View style={[styles.shadowWrap, shadows.raised]}>
      <View style={styles.card} onLayout={onLayout}>
        {cardWidth > 0 ? (
          <GestureDetector gesture={composedGesture}>
            <Animated.View style={[{ width: cardWidth, height: artHeight }, contentStyle]}>
              <Image source={ILLUSTRATED_MAP_IMAGE} style={styles.art} resizeMode="cover" />
              {pins.map((pin) => (
                <PreviewPin key={pin.id} pin={pin} scale={scale} onPress={() => onPressPin?.(pin.id)} />
              ))}
            </Animated.View>
          </GestureDetector>
        ) : null}

        {/* Controls sit on the card, not on the zoomable surface. */}
        <View style={styles.ornamentBadge} pointerEvents="none">
          <OymoOrnament size={13} color={colors.accentGold} strokeWidth={1.5} />
        </View>
        <View style={styles.controls}>
          <IconButton
            icon={Locate}
            onPress={() => {
              recenter();
              onPressLocate?.();
            }}
            accessibilityLabel={t('explore.map.recenterLabel')}
            shape="roundedSquare"
          />
          <IconButton icon={Filter} onPress={onPressFilter} accessibilityLabel={t('explore.map.filterLabel')} shape="roundedSquare" />
        </View>
      </View>
    </View>
  );
}

/** One region pin, its tip on the place; counter-scaled so it keeps the
 * same size on screen while the map zooms underneath. No drawn name - the
 * atlas already paints the city names - but the localized name is always
 * its accessibility label. */
function PreviewPin({ pin, scale, onPress }: { pin: KyrgyzstanMapPin; scale: SharedValue<number>; onPress: () => void }) {
  const counterScale = useAnimatedStyle(() => ({ transform: [{ scale: 1 / scale.value }] }));
  return (
    <Animated.View style={[styles.pinAnchor, { left: `${pin.xPercent}%`, top: `${pin.yPercent}%` }, counterScale]}>
      <View style={styles.pinBox}>
        <MapPin label={pin.label} color={pin.color} variant={pin.variant} onPress={onPress} compact showLabel={false} />
        {pin.state ? (
          <View style={styles.stateBadge} pointerEvents="none">
            <RegionStateBadge state={pin.state} />
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    aspectRatio: CARD_ASPECT,
    borderRadius: radii.xxl,
  },
  card: {
    flex: 1,
    borderRadius: radii.xxl,
    overflow: 'hidden',
    justifyContent: 'center',
    // Stable ground if the art is still loading or fails to load.
    backgroundColor: colors.surfaceAlt,
  },
  art: {
    width: '100%',
    height: '100%',
  },
  // A zero-size point at the place (also the zoom counter-scale origin).
  pinAnchor: {
    position: 'absolute',
    width: 0,
    height: 0,
    overflow: 'visible',
  },
  // The marker stands on the point: its bottom edge (the tip) is the place.
  pinBox: {
    position: 'absolute',
    bottom: 0,
    left: -PIN_BOX_WIDTH / 2,
    width: PIN_BOX_WIDTH,
    alignItems: 'center',
  },
  stateBadge: {
    position: 'absolute',
    top: -6,
    right: 4,
  },
  ornamentBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(43,32,25,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    gap: 10,
  },
});
