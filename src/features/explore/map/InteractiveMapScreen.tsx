import { router } from 'expo-router';
import { Check, ChevronLeft, Minus, Plus, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, findNodeHandle, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, G, Path, Pattern } from 'react-native-svg';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, Button, IconButton, MediaImage, PhotoBadge, Skeleton } from '@/components/ui';
import { LOCATION_TONES, natureSiteCoordinates, natureSiteImages } from '@/features/explore/data';
import { buildPassport, type PassportStamp } from '@/features/journey/passport';
import type { SupportedLanguage } from '@/i18n';
import type { AgeExperience } from '@/services/ageExperience/types';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useExploreRegions } from '@/services/content/exploreService';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { useProgressStore } from '@/store/useProgressStore';
import { cardRadii, colors, elevation, fontFamily, motion, radii, spacing, textStyles, typography } from '@/theme';

import { KYRGYZSTAN_PATH, MAP_VIEWBOX_HEIGHT, MAP_VIEWBOX_WIDTH, projectLonLat } from './kyrgyzstanGeometry';
import { pinNudge, spreadPins, type PinSpread } from './pinSpread';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.4;
const FRAME_GUTTER = spacing.md;
const FRAME_BORDER = 1;
const LABEL_WIDTH = 116;
/** Room kept under the map table for the hint line + places strip. */
const HINT_SPACE = 28 + 64;
const ZOOM_STEP = 1.6;

/** Which side of its pin each name sits on - the three sites around the
 * Chuy/Naryn highlands are close together, so their labels fan out instead
 * of stacking on top of each other. Presentation only. */
const LABEL_SIDE: Record<string, 'top' | 'bottom' | 'left' | 'right'> = {
  'ala-too': 'right',
  suusamyr: 'top',
  'son-kol': 'bottom',
  'sary-chelek': 'left',
};

/** Pin visual size and touch target per age - bigger, easier for children. */
/** `alwaysLabel`: teen/adult see every name on the map; child/preteen get
 * bigger, easier pins with only the tapped place named (its photo preview
 * does the rest) - simpler, and the three close highland sites never
 * crowd into overlapping text at phone width. */
const PIN: Record<AgeExperience, { size: number; hit: number; label: number; alwaysLabel: boolean }> = {
  child: { size: 30, hit: 56, label: 14, alwaysLabel: false },
  preteen: { size: 26, hit: 48, label: 13, alwaysLabel: false },
  teen: { size: 22, hit: 44, label: 11, alwaysLabel: true },
  adult: { size: 20, hit: 44, label: 11, alwaysLabel: true },
};

type MapPlace = PassportStamp & { tagline: string; x: number; y: number };

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

/**
 * Interactive Kyrgyzstan map (/explore/map) - an offline SVG outline of
 * the country (Natural Earth, see kyrgyzstanGeometry.ts) with the six
 * existing nature destinations pinned at their real positions. Everything
 * shown about a place comes from what the app already has: names and
 * taglines from `explore_regions`, photos from `natureSiteImages`, and the
 * visited state from `buildPassport` - the same function (and the same
 * `visitedRegionIds` progress) the Discovery Passport uses. Opening the map
 * never records a visit; only the destination detail screen does, as
 * before. Pinch/pan/double-tap zoom, clamped so the country can't drift
 * off-screen; pins stay a constant size while zooming.
 */
export function InteractiveMapScreen({
  onPressBack,
  highlightIds,
  highlightTitle,
}: {
  onPressBack: () => void;
  /** When opened from a Guided Trail: only these destinations stay
   * prominent; the rest are dimmed (never hidden). */
  highlightIds?: string[];
  highlightTitle?: string;
}) {
  useTrackScreenView('explore_map');
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const isAdult = experience === 'adult';
  const pin = PIN[experience];

  const { data: regions, isLoading } = useExploreRegions();
  const visitedRegionIds = useProgressStore((state) => state.visitedRegionIds);
  const regionVisitDates = useProgressStore((state) => state.regionVisitDates);

  const passport = useMemo(
    () => buildPassport(regions ?? [], visitedRegionIds, regionVisitDates, (id) => natureSiteImages[id], language),
    [regions, visitedRegionIds, regionVisitDates, language],
  );
  const places = useMemo<MapPlace[]>(
    () =>
      passport.stamps.flatMap((stamp) => {
        const coords = natureSiteCoordinates[stamp.id];
        if (!coords) return [];
        const { x, y } = projectLonLat(coords.lon, coords.lat);
        return [
          {
            ...stamp,
            tagline: regions?.find((row) => row.id === stamp.id)?.tagline ?? '',
            x,
            y,
          },
        ];
      }),
    [passport, regions],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = places.find((place) => place.id === selectedId) ?? null;

  // Frame + map geometry (map is fitted to the frame width).
  const [frameWidth, setFrameWidth] = useState(0);
  const [availableHeight, setAvailableHeight] = useState(0);
  const reducedMotion = useReducedMotion();
  const mapHeight = frameWidth * (MAP_VIEWBOX_HEIGHT / MAP_VIEWBOX_WIDTH);
  // The map table takes the screen: as tall as the space allows (up to
  // ~1.9x the country's own height, so zoomed pans have room), never less
  // than the original 1.3x.
  const frameHeight = Math.round(Math.max(mapHeight * 1.3, Math.min(availableHeight - HINT_SPACE, mapHeight * 1.9)));

  // Close pins (Ala-Too / Suusamyr / Son-Köl) are nudged apart so their
  // touch targets never overlap at phone width; the nudge fades on zoom.
  const pinSpreads = useMemo(
    () =>
      spreadPins(
        places.map((place) => ({ x: (place.x / MAP_VIEWBOX_WIDTH) * frameWidth, y: (place.y / MAP_VIEWBOX_HEIGHT) * mapHeight })),
        pin.hit,
      ),
    [places, frameWidth, mapHeight, pin.hit],
  );

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const bounds = useSharedValue({ w: 0, h: 0, frameH: 0 });

  useEffect(() => {
    bounds.value = { w: frameWidth, h: mapHeight, frameH: frameHeight };
  }, [frameWidth, mapHeight, frameHeight, bounds]);

  // Pan limits: the zoomed map may move only as far as it overflows the
  // frame, so the country can never be dragged away.
  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = clamp(savedScale.value * event.scale, MIN_SCALE, MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      const maxX = (bounds.value.w * (scale.value - 1)) / 2;
      const maxY = Math.max(0, (bounds.value.h * scale.value - bounds.value.frameH) / 2);
      tx.value = withTiming(clamp(tx.value, -maxX, maxX));
      ty.value = withTiming(clamp(ty.value, -maxY, maxY));
      savedTx.value = clamp(tx.value, -maxX, maxX);
      savedTy.value = clamp(ty.value, -maxY, maxY);
    });

  const pan = Gesture.Pan()
    .minDistance(6)
    .averageTouches(true)
    .onUpdate((event) => {
      const maxX = (bounds.value.w * (scale.value - 1)) / 2;
      const maxY = Math.max(0, (bounds.value.h * scale.value - bounds.value.frameH) / 2);
      tx.value = clamp(savedTx.value + event.translationX, -maxX, maxX);
      ty.value = clamp(savedTy.value + event.translationY, -maxY, maxY);
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > 1.2 ? 1 : DOUBLE_TAP_SCALE;
      scale.value = withTiming(next);
      savedScale.value = next;
      if (next === 1) {
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedTx.value = 0;
        savedTy.value = 0;
      }
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  /** +/- buttons: same clamps as the pinch gesture, one step per tap. */
  function zoomBy(factor: number) {
    const next = clamp(scale.value * factor, MIN_SCALE, MAX_SCALE);
    const duration = reducedMotion ? 0 : motion.duration.base;
    scale.value = withTiming(next, { duration });
    savedScale.value = next;
    const maxX = (bounds.value.w * (next - 1)) / 2;
    const maxY = Math.max(0, (bounds.value.h * next - bounds.value.frameH) / 2);
    const nextTx = clamp(tx.value, -maxX, maxX);
    const nextTy = clamp(ty.value, -maxY, maxY);
    tx.value = withTiming(nextTx, { duration });
    ty.value = withTiming(nextTy, { duration });
    savedTx.value = nextTx;
    savedTy.value = nextTy;
  }

  const mapStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const nameRef = useRef<Text>(null);
  useEffect(() => {
    if (!selected) return;
    // Move screen-reader focus to the preview that just opened.
    const timer = setTimeout(() => {
      try {
        const node = nameRef.current ? findNodeHandle(nameRef.current) : null;
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
      } catch {
        // Not supported on this platform (web) - nothing to move.
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [selected]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <IconButton icon={ChevronLeft} size={40} iconSize={20} shape="roundedSquare" elevated={false} accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <View style={styles.headerText}>
          <Text style={[styles.title, isAdult && styles.titleEditorial]} accessibilityRole="header" numberOfLines={1}>
            {t('explore.map.title')}
          </Text>
          <View style={styles.summaryRow}>
            {passport.isComplete ? (
              <View style={styles.completeSeal} accessibilityLabel={t('journey.passport.completeTitle')}>
                <OymoOrnament size={10} color={colors.textPrimary} strokeWidth={2} />
              </View>
            ) : null}
            <Text style={styles.summary}>
              {t('explore.map.summary', {
                unlocked: passport.unlocked,
                total: passport.total,
              })}
            </Text>
          </View>
          {highlightTitle ? (
            <Text style={styles.trailChip} numberOfLines={1}>
              {t('explore.map.trailFilter', { title: highlightTitle })}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Legend - state is carried by shape + icon + text, not colour alone. */}
      <View style={styles.legend} accessible accessibilityLabel={`${t('explore.v2.visited')}; ${t('explore.map.pinNotDiscovered')}`}>
        <View style={styles.legendItem}>
          <View style={[styles.legendPin, styles.pinVisited]}>
            <Check size={8} color={colors.textPrimary} strokeWidth={3.5} />
          </View>
          <Text style={styles.legendText}>{t('explore.v2.visited')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendPin, styles.pinUnvisited]}>
            <View style={styles.legendDot} />
          </View>
          <Text style={styles.legendText}>{t('explore.map.pinNotDiscovered')}</Text>
        </View>
      </View>

      <View
        style={styles.frameWrap}
        onLayout={(event: LayoutChangeEvent) => {
          setFrameWidth(event.nativeEvent.layout.width - FRAME_GUTTER * 2 - FRAME_BORDER * 2);
          setAvailableHeight(event.nativeEvent.layout.height);
        }}
      >
        {frameWidth > 0 && !isLoading ? (
          <GestureDetector gesture={gesture}>
            <View style={[styles.frame, { height: frameHeight }]} accessibilityHint={t('explore.map.gestureHint')}>
              <Animated.View style={[{ width: frameWidth, height: mapHeight }, mapStyle]}>
                <Svg width={frameWidth} height={mapHeight} viewBox={`0 0 ${MAP_VIEWBOX_WIDTH} ${MAP_VIEWBOX_HEIGHT}`}>
                  <Defs>
                    {/* Faint ridge chevrons - a quiet mountain texture. */}
                    <Pattern id="ridges" patternUnits="userSpaceOnUse" width={34} height={22}>
                      <Path d="M3 17 L10 9 L17 17 M18 8 L24 2 L30 8" stroke="rgba(47,82,51,0.13)" strokeWidth={1.4} fill="none" />
                    </Pattern>
                  </Defs>
                  <G>
                    <Path d={KYRGYZSTAN_PATH} fill={colors.surface} fillRule="evenodd" />
                    <Path d={KYRGYZSTAN_PATH} fill="url(#ridges)" fillRule="evenodd" />
                    <Path d={KYRGYZSTAN_PATH} fill="none" stroke={colors.primary} strokeWidth={3.2} strokeLinejoin="round" />
                    <Path d={KYRGYZSTAN_PATH} fill="none" stroke={colors.accentGold} strokeWidth={0.9} strokeLinejoin="round" opacity={0.9} />
                  </G>
                </Svg>

                {places.map((place, index) => (
                  <MapPin
                    key={place.id}
                    place={place}
                    left={(place.x / MAP_VIEWBOX_WIDTH) * frameWidth}
                    top={(place.y / MAP_VIEWBOX_HEIGHT) * mapHeight}
                    scale={scale}
                    spread={pinSpreads[index]}
                    size={pin.size}
                    hit={pin.hit}
                    labelSize={pin.label}
                    labelSide={pin.alwaysLabel ? (LABEL_SIDE[place.id] ?? 'bottom') : 'bottom'}
                    showLabel={pin.alwaysLabel || place.id === selectedId}
                    editorial={isAdult}
                    selected={place.id === selectedId}
                    dimmed={!!highlightIds && !highlightIds.includes(place.id)}
                    onPress={() => setSelectedId(place.id)}
                  />
                ))}
              </Animated.View>

              <View style={styles.compass} pointerEvents="none">
                <OymoOrnament size={18} color={colors.accentGoldPressed} strokeWidth={1.5} />
                <Text style={styles.compassN}>N</Text>
              </View>
              <View style={styles.zoom}>
                <IconButton icon={Plus} size={40} iconSize={18} shape="roundedSquare" accessibilityLabel={t('explore.map.zoomIn')} onPress={() => zoomBy(ZOOM_STEP)} />
                <IconButton icon={Minus} size={40} iconSize={18} shape="roundedSquare" accessibilityLabel={t('explore.map.zoomOut')} onPress={() => zoomBy(1 / ZOOM_STEP)} />
              </View>
            </View>
          </GestureDetector>
        ) : (
          <Skeleton height={Math.max(200, frameHeight)} borderRadius={radii.xl} />
        )}
        <Text style={styles.hint}>{t('explore.map.gestureHint')}</Text>
        {/* Every place as a readable chip - an easy, screen-reader-friendly
            alternative to small pins; tapping one opens the same sheet. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.places} style={styles.placesBleed}>
          {places.map((place) => (
            <AnimatedPressable
              key={place.id}
              style={[styles.placeChip, place.id === selectedId && styles.placeChipSelected]}
              onPress={() => setSelectedId(place.id)}
              press="strong"
              accessibilityRole="button"
              accessibilityState={{ selected: place.id === selectedId }}
              accessibilityLabel={`${place.title}, ${place.unlocked ? t('explore.map.pinDiscovered') : t('explore.map.pinNotDiscovered')}`}
            >
              <View style={[styles.placeThumb, { backgroundColor: LOCATION_TONES[place.toneIndex % LOCATION_TONES.length] }]}>
                {place.imageSource ? <MediaImage source={place.imageSource} /> : null}
                {place.unlocked ? (
                  <View style={styles.placeCheck}>
                    <Check size={8} color={colors.textPrimary} strokeWidth={3.5} />
                  </View>
                ) : null}
              </View>
              <Text style={styles.placeName} numberOfLines={1}>
                {place.title}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>
      </View>

      {selected ? (
        <Animated.View
          key={selected.id}
          entering={reducedMotion ? undefined : FadeInDown.duration(motion.sheetEnter.durationMs)}
          style={[styles.preview, { bottom: insets.bottom + spacing.sm }]}
        >
          <View style={styles.handle} />
          <View style={styles.previewRow}>
            <View style={[styles.previewImage, { backgroundColor: LOCATION_TONES[selected.toneIndex % LOCATION_TONES.length] }]}>
              {selected.imageSource ? <MediaImage source={selected.imageSource} /> : <OymoOrnament size={28} color="rgba(251,243,227,0.5)" strokeWidth={1.2} />}
            </View>
            <View style={styles.previewText}>
              {selected.unlocked ? <PhotoBadge kind="visited" label={t('explore.v2.visited')} /> : <Text style={styles.previewState}>{t('explore.map.pinNotDiscovered')}</Text>}
              <Text ref={nameRef} style={[styles.previewName, isAdult && styles.titleEditorial]} numberOfLines={2} accessibilityRole="header">
                {selected.title}
              </Text>
              <Text style={styles.previewTagline} numberOfLines={1}>
                {selected.tagline}
              </Text>
            </View>
            <IconButton icon={X} size={32} iconSize={16} elevated={false} accessibilityLabel={t('explore.map.closePreview')} onPress={() => setSelectedId(null)} />
          </View>
          <Button label={t('explore.map.explore')} variant="accent" block onPress={() => router.push(selected.route as never)} accessibilityHint={selected.title} />
        </Animated.View>
      ) : null}
    </View>
  );
}

type MapPinProps = {
  place: MapPlace;
  left: number;
  top: number;
  scale: SharedValue<number>;
  spread: PinSpread;
  size: number;
  hit: number;
  labelSize: number;
  labelSide: 'top' | 'bottom' | 'left' | 'right';
  showLabel: boolean;
  dimmed: boolean;
  editorial: boolean;
  selected: boolean;
  onPress: () => void;
};

/** One destination pin. Counter-scaled against the map zoom so it stays the
 * same size on screen while the country grows underneath it; `spread`
 * keeps it clear of a too-close neighbour at low zoom. */
function MapPin({ place, left, top, scale, spread, size, hit, labelSize, labelSide, showLabel, dimmed, editorial, selected, onPress }: MapPinProps) {
  const { t } = useTranslation();
  const counterScale = useAnimatedStyle(() => {
    // The parent map is scaled, so divide the screen-px nudge by the zoom.
    const nudge = pinNudge(spread, hit, scale.value);
    return { transform: [{ translateX: nudge.x / scale.value }, { translateY: nudge.y / scale.value }, { scale: 1 / scale.value }] };
  });
  const visited = place.unlocked;

  return (
    <Animated.View style={[styles.pinAnchor, { left: left - hit / 2, top: top - hit / 2, width: hit, height: hit }, dimmed && styles.pinDimmed, counterScale]}>
      <AnimatedPressable
        style={[styles.pinHit, { width: hit, height: hit }]}
        onPress={onPress}
        pressScale={0.9}
        haptic="light"
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${place.title}, ${visited ? t('explore.map.pinDiscovered') : t('explore.map.pinNotDiscovered')}`}
      >
        <View
          style={[
            styles.pin,
            { width: size, height: size, borderRadius: size / 2 },
            visited ? styles.pinVisited : styles.pinUnvisited,
            selected && styles.pinSelected,
          ]}
        >
          {visited ? (
            <Check size={size * 0.5} color={colors.textPrimary} strokeWidth={3} />
          ) : (
            <View
              style={[
                styles.pinDot,
                {
                  width: size * 0.3,
                  height: size * 0.3,
                  borderRadius: size * 0.15,
                },
              ]}
            />
          )}
        </View>
      </AnimatedPressable>
      {showLabel ? (
        <View style={[styles.pinLabelBox, labelPosition(labelSide, hit, size)]} pointerEvents="none">
          <Text
            style={[
              styles.pinLabel,
              {
                fontSize: labelSize,
                textAlign: labelSide === 'left' ? 'right' : labelSide === 'right' ? 'left' : 'center',
              },
              editorial && styles.pinLabelEditorial,
              !visited && styles.pinLabelMuted,
            ]}
            numberOfLines={1}
            importantForAccessibility="no"
            accessibilityElementsHidden
          >
            {place.title}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

/** Places the name box beside the pin circle without covering it. */
function labelPosition(side: 'top' | 'bottom' | 'left' | 'right', hit: number, size: number) {
  const gap = (hit - size) / 2 - 2;
  if (side === 'top') return { bottom: hit - gap, left: (hit - LABEL_WIDTH) / 2 };
  if (side === 'bottom') return { top: hit - gap, left: (hit - LABEL_WIDTH) / 2 };
  if (side === 'left') return { right: hit - gap, top: hit / 2 - 8 };
  return { left: hit - gap, top: hit / 2 - 8 };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...textStyles.h2,
    color: colors.textPrimary,
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendPin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accentBrown,
  },
  legendText: {
    ...textStyles.small,
    color: colors.textSecondary,
  },
  placesBleed: {
    marginHorizontal: -FRAME_GUTTER,
    flexGrow: 0,
  },
  places: {
    gap: spacing.xs,
    paddingHorizontal: FRAME_GUTTER,
    paddingTop: spacing.xs,
  },
  placeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingLeft: 5,
    paddingRight: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  placeChipSelected: {
    borderColor: colors.accentTerracotta,
  },
  placeThumb: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  placeCheck: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentGold,
  },
  placeName: {
    ...textStyles.caption,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  zoom: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    gap: spacing.xs,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderSubtle,
    marginTop: -4,
  },
  titleEditorial: {
    fontFamily: fontFamily.wordmark,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  summary: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.accentTerracotta,
  },
  completeSeal: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameWrap: {
    flex: 1,
    paddingHorizontal: FRAME_GUTTER,
    gap: spacing.xs,
  },
  // Clipped "map table": the zoomed country never paints outside it.
  frame: {
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'center',
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceAlt,
    borderWidth: FRAME_BORDER,
    borderColor: 'rgba(199,154,46,0.35)',
  },
  compass: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    alignItems: 'center',
  },
  compassN: {
    ...typography.small,
    color: colors.accentBrown,
  },
  hint: {
    ...typography.small,
    fontWeight: '500',
    color: colors.textMuted,
    textAlign: 'center',
  },
  pinAnchor: {
    position: 'absolute',
    alignItems: 'center',
  },
  pinDimmed: {
    opacity: 0.3,
  },
  trailChip: {
    ...typography.small,
    color: colors.primary,
    marginTop: 2,
  },
  pinHit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  pinUnvisited: {
    backgroundColor: colors.surface,
    borderColor: colors.accentBrown,
  },
  pinVisited: {
    backgroundColor: colors.accentGold,
    borderColor: colors.primary,
  },
  pinSelected: {
    borderColor: colors.accentTerracotta,
    borderWidth: 3,
  },
  pinDot: {
    backgroundColor: colors.accentBrown,
  },
  pinLabelBox: {
    position: 'absolute',
    width: LABEL_WIDTH,
  },
  pinLabel: {
    ...typography.small,
    color: colors.primary,
    textShadowColor: 'rgba(251,243,227,0.9)',
    textShadowRadius: 3,
  },
  pinLabelEditorial: {
    fontFamily: fontFamily.wordmark,
  },
  pinLabelMuted: {
    color: colors.textSecondary,
  },
  preview: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    padding: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderRadius: cardRadii.hero,
    backgroundColor: colors.surfaceElevated,
    ...elevation.floating,
  },
  previewRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  previewImage: {
    width: 72,
    height: 72,
    borderRadius: cardRadii.chip,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    flex: 1,
    gap: 3,
    alignItems: 'flex-start',
  },
  previewState: {
    ...typography.overline,
    color: colors.accentTerracotta,
  },
  previewName: {
    ...textStyles.h3,
    color: colors.textPrimary,
  },
  previewTagline: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
