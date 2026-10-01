import { router } from 'expo-router';
import { Check, ChevronLeft, Minus, Plus, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, findNodeHandle, Image, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, Button, IconButton, MediaImage, PhotoBadge, Skeleton } from '@/components/ui';
import { LOCATION_TONES, natureSiteImages } from '@/features/explore/data';
import { regionHubRoute, regionTone } from '@/features/explore/regions/regionExperiences';
import { regionSummary, type RegionStatus } from '@/features/explore/regions/regionModel';
import { useRegionExperiences } from '@/features/explore/regions/useRegionExperiences';
import { useRegionSignals } from '@/features/explore/regions/useRegionSignals';
import { buildPassport, type PassportStamp } from '@/features/journey/passport';
import type { SupportedLanguage } from '@/i18n';
import type { AgeExperience } from '@/services/ageExperience/types';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { track } from '@/services/analytics/analytics';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useExploreRegions } from '@/services/content/exploreService';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { useProgressStore } from '@/store/useProgressStore';
import { cardRadii, colors, elevation, fontFamily, motion, radii, spacing, textStyles, typography } from '@/theme';

import { ILLUSTRATED_MAP_ASPECT, ILLUSTRATED_MAP_COORDINATES, ILLUSTRATED_MAP_IMAGE, panLimits } from './illustratedMap';
import { pinNudge, spreadPins, type PinSpread } from './pinSpread';
import { buildRegionMapMarkers, canShowProgressMode, type MapMode, type RegionMapMarker } from './regionMapProgress';

const MIN_SCALE = 1;
/** The atlas is 1448 px wide and fills ~1.25x the frame width at rest, so
 * 3x keeps it close to one source pixel per screen point - sharper than
 * letting it blur at 4x. */
const MAX_SCALE = 3;
const DOUBLE_TAP_SCALE = 2.4;
const FRAME_GUTTER = spacing.md;
const FRAME_BORDER = 1;
const LABEL_WIDTH = 116;
/** Room kept under the map table for the hint line + places strip. */
const HINT_SPACE = 28 + 64;
/** At most this much of the atlas's width is cropped off at rest (it
 * covers a taller map table) - the whole of Kyrgyzstan's core, Issyk-Kul
 * included, stays in view; the far edges are a pan away. */
const MAX_REST_COVER = 1.25;
const ZOOM_STEP = 1.6;

/** Which side of its pin each name sits on - chosen so close sites fan
 * out and no name lands on a city name painted on the atlas (Bishkek,
 * Jalal-Abad, Naryn). Presentation only. */
const LABEL_SIDE: Record<string, 'top' | 'bottom' | 'left' | 'right'> = {
  'ala-too': 'right',
  suusamyr: 'bottom',
  'son-kol': 'right',
  'sary-chelek': 'left',
  arslanbob: 'left',
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

/** `x`/`y`: position on the illustrated atlas, 0..1 of its width/height. */
type MapPlace = PassportStamp & { tagline: string; x: number; y: number };

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

/**
 * Interactive Kyrgyzstan map (/explore/map) - the OYNO illustrated atlas
 * (illustratedMap.ts, the same art as the Explore preview) with the six
 * existing nature destinations pinned where they appear on it. The art is
 * an illustration, not exact geography: pins are placed on the painting,
 * real lat/lon stays in natureSiteCoordinates. Everything
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
        const position = ILLUSTRATED_MAP_COORDINATES[stamp.id];
        if (!position) return [];
        return [
          {
            ...stamp,
            tagline: regions?.find((row) => row.id === stamp.id)?.tagline ?? '',
            x: position.xPercent / 100,
            y: position.yPercent / 100,
          },
        ];
      }),
    [passport, regions],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = places.find((place) => place.id === selectedId) ?? null;

  // "My progress": one marker per Region Hub with the same derived state
  // as the Passport and Home. Places stays the default; a trail/region
  // filter keeps its own focused view (no switch offered).
  const regionConfigs = useRegionExperiences();
  const regionSignals = useRegionSignals();
  const showModeSwitch = canShowProgressMode(highlightIds);
  const [mode, setMode] = useState<MapMode>('places');
  const progressMode = showModeSwitch && mode === 'progress';
  const regionMarkers = useMemo(() => buildRegionMapMarkers(regionConfigs, regions ?? [], regionSignals, language), [regionConfigs, regions, regionSignals, language]);
  const regionTotals = regionSummary(regionConfigs, regionSignals);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const selectedRegion = progressMode ? (regionMarkers.find((marker) => marker.id === selectedRegionId) ?? null) : null;
  const regionStateLabel = (status: RegionStatus) => t(`journey.regions.state.${status}`);
  const regionMarkerLabel = (marker: RegionMapMarker) =>
    `${t('journey.regions.a11yName', { name: marker.name })}. ${regionStateLabel(marker.status)}.${marker.status === 'in_progress' ? ` ${t('regionHub.progress', { completed: marker.progress.completed, total: marker.progress.total })}.` : ''}`;

  function switchMode(next: MapMode) {
    if (next === mode) return;
    setMode(next);
    setSelectedId(null);
    setSelectedRegionId(null);
    if (next === 'progress') track('map_region_progress_opened', { started: regionTotals.started, completed: regionTotals.completed });
  }

  // Frame + map geometry. The map table is as tall as the space allows,
  // from the atlas's own full-width height up to MAX_REST_COVER of it; the
  // atlas then covers the table (never letterboxed), centred.
  const [frameWidth, setFrameWidth] = useState(0);
  const [availableHeight, setAvailableHeight] = useState(0);
  const reducedMotion = useReducedMotion();
  const fitHeight = frameWidth / ILLUSTRATED_MAP_ASPECT;
  const frameHeight = Math.round(Math.max(fitHeight, Math.min(availableHeight - HINT_SPACE, fitHeight * MAX_REST_COVER)));
  const mapHeight = frameHeight;
  const mapWidth = frameHeight * ILLUSTRATED_MAP_ASPECT;
  /** How far the atlas's left edge sits outside the table at rest. */
  const restOverhang = (mapWidth - frameWidth) / 2;

  // Close pins (Ala-Too / Suusamyr / Son-Köl) are nudged apart so their
  // touch targets never overlap at phone width; the nudge fades on zoom.
  const pinSpreads = useMemo(
    () =>
      spreadPins(
        places.map((place) => ({ x: place.x * mapWidth, y: place.y * mapHeight })),
        pin.hit,
      ),
    [places, mapWidth, mapHeight, pin.hit],
  );

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const bounds = useSharedValue({ w: 0, h: 0, frameW: 0, frameH: 0 });

  useEffect(() => {
    bounds.value = { w: mapWidth, h: mapHeight, frameW: frameWidth, frameH: frameHeight };
  }, [mapWidth, mapHeight, frameWidth, frameHeight, bounds]);

  // Pan limits: the map may move only as far as it overflows the frame, so
  // the atlas can never be dragged away and no blank edge ever shows.
  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = clamp(savedScale.value * event.scale, MIN_SCALE, MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      const { maxX, maxY } = panLimits(bounds.value.w, bounds.value.h, bounds.value.frameW, bounds.value.frameH, scale.value);
      tx.value = withTiming(clamp(tx.value, -maxX, maxX));
      ty.value = withTiming(clamp(ty.value, -maxY, maxY));
      savedTx.value = clamp(tx.value, -maxX, maxX);
      savedTy.value = clamp(ty.value, -maxY, maxY);
    });

  const pan = Gesture.Pan()
    .minDistance(6)
    .averageTouches(true)
    .onUpdate((event) => {
      const { maxX, maxY } = panLimits(bounds.value.w, bounds.value.h, bounds.value.frameW, bounds.value.frameH, scale.value);
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
    const { maxX, maxY } = panLimits(bounds.value.w, bounds.value.h, bounds.value.frameW, bounds.value.frameH, next);
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
            <Text style={styles.summary} accessibilityLiveRegion="polite">
              {progressMode
                ? `${t('journey.regions.started', { count: regionTotals.started, total: regionTotals.total })} · ${t('journey.regions.completedCount', { count: regionTotals.completed, total: regionTotals.total })}`
                : t('explore.map.summary', {
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

      {showModeSwitch ? (
        <View style={styles.modeSwitch} accessibilityRole="radiogroup" accessibilityLabel={t('explore.map.modeLabel')}>
          {(['places', 'progress'] as const).map((option) => (
            <AnimatedPressable
              key={option}
              style={[styles.modeOption, mode === option && styles.modeOptionActive]}
              onPress={() => switchMode(option)}
              accessibilityRole="radio"
              accessibilityState={{ checked: mode === option }}
              accessibilityLabel={t(`explore.map.mode.${option}`)}
            >
              <Text style={[styles.modeText, mode === option && styles.modeTextActive]}>{t(`explore.map.mode.${option}`)}</Text>
            </AnimatedPressable>
          ))}
        </View>
      ) : null}

      {progressMode ? (
        <View
          style={styles.legend}
          accessible
          accessibilityLabel={`${regionStateLabel('not_started')}; ${regionStateLabel('in_progress')}; ${regionStateLabel('completed')}`}
        >
          {(['not_started', 'in_progress', 'completed'] as const).map((status) => (
            <View key={status} style={styles.legendItem}>
              <RegionBadge status={status} tone={colors.primary} size={14} />
              <Text style={styles.legendText}>{regionStateLabel(status)}</Text>
            </View>
          ))}
        </View>
      ) : (
      /* Legend - state is carried by shape + icon + text, not colour alone. */
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
      )}

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
              {/* Art and pins are one transformed surface - they move together. */}
              <Animated.View style={[{ width: mapWidth, height: mapHeight }, mapStyle]}>
                <Image source={ILLUSTRATED_MAP_IMAGE} style={{ width: mapWidth, height: mapHeight }} resizeMode="cover" accessibilityIgnoresInvertColors />

                {progressMode
                  ? regionMarkers.map((marker) => (
                      <RegionMarkerPin
                        key={marker.id}
                        marker={marker}
                        left={marker.x * mapWidth}
                        top={marker.y * mapHeight}
                        scale={scale}
                        hit={pin.hit}
                        labelSize={pin.label}
                        selected={marker.id === selectedRegionId}
                        accessibilityLabel={regionMarkerLabel(marker)}
                        onPress={() => setSelectedRegionId(marker.id)}
                      />
                    ))
                  : places.map((place, index) => (
                  <MapPin
                    key={place.id}
                    place={place}
                    left={place.x * mapWidth}
                    top={place.y * mapHeight}
                    scale={scale}
                    spread={pinSpreads[index]}
                    size={pin.size}
                    hit={pin.hit}
                    labelSize={pin.label}
                    labelSide={labelSideFor(place, place.x * mapWidth - restOverhang, pin.alwaysLabel, pin.label)}
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
          {progressMode
            ? regionMarkers.map((marker) => (
                <AnimatedPressable
                  key={marker.id}
                  style={[styles.placeChip, marker.id === selectedRegionId && styles.placeChipSelected]}
                  onPress={() => setSelectedRegionId(marker.id)}
                  press="strong"
                  accessibilityRole="button"
                  accessibilityState={{ selected: marker.id === selectedRegionId }}
                  accessibilityLabel={regionMarkerLabel(marker)}
                >
                  <RegionBadge status={marker.status} tone={regionTone(marker.id)} size={22} />
                  <Text style={styles.placeName} numberOfLines={1}>
                    {marker.name}
                  </Text>
                </AnimatedPressable>
              ))
            : places.map((place) => (
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

      {selectedRegion ? (
        <Animated.View
          key={`region-${selectedRegion.id}`}
          entering={reducedMotion ? undefined : FadeInDown.duration(motion.sheetEnter.durationMs)}
          style={[styles.preview, { bottom: insets.bottom + spacing.sm }]}
        >
          <View style={styles.handle} />
          <View style={styles.previewRow}>
            <RegionBadge status={selectedRegion.status} tone={regionTone(selectedRegion.id)} size={44} />
            <View style={styles.previewText}>
              <Text style={styles.previewState}>{regionStateLabel(selectedRegion.status)}</Text>
              <Text style={[styles.previewName, isAdult && styles.titleEditorial]} numberOfLines={2} accessibilityRole="header">
                {selectedRegion.name}
              </Text>
              <Text style={styles.previewTagline} numberOfLines={1}>
                {t('regionHub.progress', { completed: selectedRegion.progress.completed, total: selectedRegion.progress.total })}
              </Text>
            </View>
            <IconButton icon={X} size={32} iconSize={16} elevated={false} accessibilityLabel={t('explore.map.closePreview')} onPress={() => setSelectedRegionId(null)} />
          </View>
          <Button label={t('explore.map.openRegion')} variant="accent" block onPress={() => router.push(regionHubRoute(selectedRegion.id) as never)} accessibilityHint={selectedRegion.name} />
        </Animated.View>
      ) : null}

      {selected && !progressMode ? (
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
        <View style={[styles.pinLabelBox, labelPosition(labelSide, hit, size), { alignItems: labelSide === 'left' ? 'flex-end' : labelSide === 'right' ? 'flex-start' : 'center' }]} pointerEvents="none">
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

/** Region state by shape + icon, never colour alone: dashed ring = not
 * started, filled ornament = in progress, gold check = completed. */
function RegionBadge({ status, tone, size }: { status: RegionStatus; tone: string; size: number }) {
  return (
    <View
      style={[
        styles.regionBadge,
        { width: size, height: size, borderRadius: size / 2 },
        status === 'completed' ? styles.regionBadgeDone : status === 'in_progress' ? { backgroundColor: tone, borderColor: colors.surface } : styles.regionBadgeIdle,
      ]}
    >
      {status === 'completed' ? (
        <Check size={size * 0.55} color={colors.textPrimary} strokeWidth={3} />
      ) : status === 'in_progress' ? (
        <OymoOrnament size={size * 0.55} color={colors.textOnDark} strokeWidth={1.75} />
      ) : null}
    </View>
  );
}

/** One region marker: counter-scaled like the place pins, name + count
 * below. Stands for the whole region - no outline is drawn. */
function RegionMarkerPin({
  marker,
  left,
  top,
  scale,
  hit,
  labelSize,
  selected,
  accessibilityLabel,
  onPress,
}: {
  marker: RegionMapMarker;
  left: number;
  top: number;
  scale: SharedValue<number>;
  hit: number;
  labelSize: number;
  selected: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const counterScale = useAnimatedStyle(() => ({ transform: [{ scale: 1 / scale.value }] }));
  const size = Math.round(hit * 0.62);
  return (
    <Animated.View style={[styles.pinAnchor, { left: left - hit / 2, top: top - hit / 2, width: hit, height: hit }, counterScale]}>
      <AnimatedPressable style={[styles.pinHit, { width: hit, height: hit }]} onPress={onPress} pressScale={0.9} haptic="light" accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={accessibilityLabel}>
        <View style={selected ? styles.regionSelected : undefined}>
          <RegionBadge status={marker.status} tone={regionTone(marker.id)} size={size} />
        </View>
      </AnimatedPressable>
      <View style={[styles.pinLabelBox, labelPosition('bottom', hit, size), { alignItems: 'center' }]} pointerEvents="none">
        <Text style={[styles.pinLabel, { fontSize: labelSize, textAlign: 'center' }, marker.status === 'not_started' && styles.pinLabelMuted]} numberOfLines={1} importantForAccessibility="no" accessibilityElementsHidden>
          {marker.name}
          {marker.progress.total > 0 ? ` ${marker.progress.completed}/${marker.progress.total}` : ''}
        </Text>
      </View>
    </Animated.View>
  );
}

/** The preferred side for a pin's name, except that a left-side label is
 * moved above the pin when the name would run past the map's left edge
 * (narrow 375 pt frames) - presentation only, coordinates unchanged. */
function labelSideFor(place: MapPlace, left: number, alwaysLabel: boolean, labelSize: number): 'top' | 'bottom' | 'left' | 'right' {
  if (!alwaysLabel) return 'bottom';
  const side = LABEL_SIDE[place.id] ?? 'bottom';
  const estimatedWidth = place.title.length * labelSize * 0.62 + 14;
  return side === 'left' && left < estimatedWidth ? 'top' : side;
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
  // Clipped "map table": the zoomed atlas never paints outside it. The
  // background is the stable ground while the art loads (or if it fails).
  frame: {
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
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
  // Dimmed, never hidden - still findable over the busy atlas art.
  pinDimmed: {
    opacity: 0.5,
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
  // A small light pill: app labels read clearly over the busy atlas art
  // and never look like (or merge with) the names painted into it.
  pinLabel: {
    ...typography.small,
    color: colors.primary,
    overflow: 'hidden',
    paddingHorizontal: 5,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(251,243,227,0.9)',
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
  modeSwitch: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    padding: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
  },
  modeOption: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  },
  modeOptionActive: {
    backgroundColor: colors.surfaceElevated,
  },
  modeText: {
    ...textStyles.small,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modeTextActive: {
    color: colors.textPrimary,
  },
  regionBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  regionBadgeIdle: {
    borderStyle: 'dashed',
    borderColor: colors.textMuted,
    backgroundColor: 'rgba(251,243,227,0.85)',
  },
  regionBadgeDone: {
    backgroundColor: colors.accentGold,
    borderColor: colors.surface,
  },
  regionSelected: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: 2,
  },
  previewTagline: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
