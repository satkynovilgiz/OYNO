import type { ImageSourcePropType } from 'react-native';

import atlasImage from '@assets/img/OYNO_design/oyno_kyrgyzstan_3d_map_full.jpg';

/**
 * The OYNO illustrated atlas: one 3D map painting (Kyrgyzstan with its
 * neighbours around it) used as the visual background of BOTH the Explore
 * preview card and the full /explore/map screen.
 *
 * It is decorative cartography, not geographic data: nothing measures
 * distance, routes or borders on it. Real positions stay in
 * `natureSiteCoordinates` (lat/lon) and `kyrgyzstanGeometry.ts`; this file
 * only says where each existing OYNO destination visually appears on the
 * painting. Neighbouring countries are context only - no destination here
 * lies outside Kyrgyzstan.
 */
export const ILLUSTRATED_MAP_IMAGE: ImageSourcePropType = atlasImage;

/** Source pixel size (1448 x 1086) - the art is always shown at this aspect. */
export const ILLUSTRATED_MAP_ASPECT = 1448 / 1086;

export type IllustratedMapCoordinate = { xPercent: number; yPercent: number };

/**
 * Percent of the painting's width/height, measured on the 1448x1086 source
 * (pixel position in the comment). Cities with a painted dot (Talas, Bishkek,
 * Jalal-Abad, Naryn, Osh) sit on that dot and Ysyk-Kol on the lake. Places
 * the painting doesn't mark were placed from their real lat/lon, corrected
 * against the nearest painted city (the painting is not a linear
 * projection) and kept off the painted lettering.
 */
export const ILLUSTRATED_MAP_COORDINATES: Record<string, IllustratedMapCoordinate> = {
  // Explore regions (preview card pins).
  talas: { xPercent: 31.6, yPercent: 30.4 }, // 457,330 painted dot
  chuy: { xPercent: 44.9, yPercent: 26.9 }, // 650,292 Chuy valley west of Bishkek
  bishkek: { xPercent: 51.1, yPercent: 26.1 }, // 740,283 painted star
  'ysyk-kol': { xPercent: 73.6, yPercent: 35.5 }, // 1066,385 the lake
  'jalal-abad': { xPercent: 28.6, yPercent: 47.5 }, // 414,516 painted dot
  naryn: { xPercent: 58.5, yPercent: 49.8 }, // 847,541 painted dot
  osh: { xPercent: 34.4, yPercent: 59.9 }, // 498,650 painted dot
  batken: { xPercent: 15.9, yPercent: 51.6 }, // 230,560 south-western arm
  // Nature destinations (Discovery Passport, full map pins).
  'son-kol': { xPercent: 52.5, yPercent: 46.5 }, // 760,505 north-west of Naryn
  suusamyr: { xPercent: 44.5, yPercent: 35.0 }, // 645,380 valley south-west of Bishkek
  alay: { xPercent: 38.7, yPercent: 65.8 }, // 560,715 south of Osh
  'sary-chelek': { xPercent: 25.6, yPercent: 39.1 }, // 370,425 north-west of Jalal-Abad
  arslanbob: { xPercent: 31.1, yPercent: 43.3 }, // 450,470 north-east of Jalal-Abad
  'ala-too': { xPercent: 50.8, yPercent: 32.2 }, // 735,350 south of Bishkek
};

/**
 * How far a map of `contentW` x `contentH`, centred in a `frameW` x
 * `frameH` viewport and scaled by `scale`, may be panned before its edge
 * would enter the viewport - so the art can never be dragged away.
 */
export function panLimits(contentW: number, contentH: number, frameW: number, frameH: number, scale: number): { maxX: number; maxY: number } {
  'worklet';
  return { maxX: Math.max(0, (contentW * scale - frameW) / 2), maxY: Math.max(0, (contentH * scale - frameH) / 2) };
}

/**
 * "My progress" region markers: one presentation anchor per Region Hub on
 * the painting - the region's painted city dot (Talas, Jalal-Abad, Naryn,
 * Osh), the lake for Ysyk-Kol, the Chuy valley and Batken's south-western
 * arm. A marker stands for the whole region; nothing here draws or implies
 * a border. Separate from the place pins so the two layers never mix.
 */
export const REGION_MAP_ANCHORS: Record<string, IllustratedMapCoordinate> = {
  chuy: ILLUSTRATED_MAP_COORDINATES.chuy,
  talas: ILLUSTRATED_MAP_COORDINATES.talas,
  'ysyk-kol': ILLUSTRATED_MAP_COORDINATES['ysyk-kol'],
  naryn: ILLUSTRATED_MAP_COORDINATES.naryn,
  'jalal-abad': ILLUSTRATED_MAP_COORDINATES['jalal-abad'],
  osh: ILLUSTRATED_MAP_COORDINATES.osh,
  batken: ILLUSTRATED_MAP_COORDINATES.batken,
};
