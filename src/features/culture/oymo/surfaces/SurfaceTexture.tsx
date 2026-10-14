import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { MotifLayer } from '@/services/culture/oymoEditor';
import type { SymmetryMode } from '@/services/culture/symmetry';

import { OymoArtwork } from '../components/OymoArtwork';
import { paperSpeckles, type SurfaceId } from './surfacesModel';

/*
 * ORIGINAL textures, drawn here in code (provenance: surfacesModel.ts
 * TEXTURE_PROVENANCE). They sit OVER the design at low opacity - the
 * design's own geometry and colours underneath are never changed. Repeating
 * <Pattern> tiles keep the cost flat at any size (no per-pixel noise).
 */
const PAPER_TILE = 48;
const FABRIC_TILE = 6;
// Neutral ink tones of the textures themselves (not UI colours).
const GRAIN_DARK = '#5C4326';
const GRAIN_LIGHT = '#FFFFFF';

export function SurfaceTexture({ surface, size }: { surface: SurfaceId; size: number }) {
  const specks = useMemo(() => paperSpeckles(PAPER_TILE, 26), []);
  if (surface === 'plain') return null;
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none" testID={`surface-texture-${surface}`}>
      <Defs>
        {surface === 'paper' ? (
          <>
            <Pattern id="oyno-paper" width={PAPER_TILE} height={PAPER_TILE} patternUnits="userSpaceOnUse">
              {specks.map((speck, index) => (
                <Circle key={index} cx={speck.x} cy={speck.y} r={speck.r} fill={speck.dark ? GRAIN_DARK : GRAIN_LIGHT} opacity={speck.dark ? 0.14 : 0.3} />
              ))}
            </Pattern>
            <RadialGradient id="oyno-paper-edge" cx="50%" cy="50%" r="72%">
              <Stop offset="0.62" stopColor={GRAIN_DARK} stopOpacity={0} />
              <Stop offset="1" stopColor={GRAIN_DARK} stopOpacity={0.16} />
            </RadialGradient>
          </>
        ) : (
          <>
            <Pattern id="oyno-fabric" width={FABRIC_TILE} height={FABRIC_TILE} patternUnits="userSpaceOnUse">
              {/* Plain weave: warp (vertical) and weft (horizontal) threads, light over dark, alternating. */}
              <Line x1={1.5} y1={0} x2={1.5} y2={FABRIC_TILE} stroke={GRAIN_DARK} strokeWidth={1} opacity={0.12} />
              <Line x1={4.5} y1={0} x2={4.5} y2={FABRIC_TILE} stroke={GRAIN_LIGHT} strokeWidth={1} opacity={0.16} />
              <Line x1={0} y1={1.5} x2={FABRIC_TILE} y2={1.5} stroke={GRAIN_LIGHT} strokeWidth={1} opacity={0.16} />
              <Line x1={0} y1={4.5} x2={FABRIC_TILE} y2={4.5} stroke={GRAIN_DARK} strokeWidth={1} opacity={0.12} />
            </Pattern>
            <LinearGradient id="oyno-fabric-light" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={GRAIN_LIGHT} stopOpacity={0.14} />
              <Stop offset="0.55" stopColor={GRAIN_LIGHT} stopOpacity={0} />
              <Stop offset="1" stopColor={GRAIN_DARK} stopOpacity={0.12} />
            </LinearGradient>
          </>
        )}
      </Defs>
      <Rect x={0} y={0} width={size} height={size} fill={surface === 'paper' ? 'url(#oyno-paper)' : 'url(#oyno-fabric)'} />
      <Rect x={0} y={0} width={size} height={size} fill={surface === 'paper' ? 'url(#oyno-paper-edge)' : 'url(#oyno-fabric-light)'} />
    </Svg>
  );
}

/**
 * The ONE rendering used for the on-screen preview AND the exported card:
 * the design exactly as drawn (OymoArtwork), with the surface over it.
 */
export function SurfacedArtwork({ layers, backgroundColor, symmetryMode, surface, size }: { layers: MotifLayer[]; backgroundColor: string; symmetryMode: SymmetryMode; surface: SurfaceId; size: number }) {
  return (
    <View style={{ width: size, height: size, overflow: 'hidden' }} testID={`surfaced-artwork-${surface}`}>
      <OymoArtwork layers={layers} backgroundColor={backgroundColor} symmetryMode={symmetryMode} size={size} />
      <SurfaceTexture surface={surface} size={size} />
    </View>
  );
}
