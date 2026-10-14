import Svg, { Line, Rect } from 'react-native-svg';

import type { SymmetryMode } from '@/services/culture/symmetry';
import { colors } from '@/theme';

import { guideLines, SAFE_MARGIN, type GuideSettings } from './compositionGuides';

/**
 * The composition guides, drawn ONLY in the Creator's editing canvas (inside
 * the zoomed view, so they stay on the artwork's coordinates). Exports,
 * share cards, previews and every other screen draw the artwork through
 * OymoArtwork, which has no guides - nothing here can reach an image.
 *
 * Each line is a light halo under a dark line, so it reads on light and dark
 * backgrounds alike; widths are divided by the zoom so lines stay hairlines.
 * The snapped line(s) are drawn bold in the accent colour (the indicator),
 * mirrored where the symmetry puts a copy.
 */
const DARK = 'rgba(31,42,36,0.5)';
const HALO = 'rgba(255,253,247,0.7)';
const ACTIVE = colors.accentTerracottaText;

export function GuidesOverlay({ settings, size, zoom, symmetryMode, highlight }: { settings: GuideSettings; size: number; zoom: number; symmetryMode: SymmetryMode; highlight: { x: number | null; y: number | null } | null }) {
  const lines = guideLines(settings, size).filter((line) => line.kind !== 'margin');
  const w = (px: number) => px / zoom;
  const mirroredX = symmetryMode !== 'none';
  const mirroredY = symmetryMode === 'fourWay';
  const activeX = highlight?.x == null ? [] : [...new Set([highlight.x, ...(mirroredX ? [size - highlight.x] : [])])];
  const activeY = highlight?.y == null ? [] : [...new Set([highlight.y, ...(mirroredY ? [size - highlight.y] : [])])];
  if (lines.length === 0 && !settings.margins && activeX.length === 0 && activeY.length === 0) return null;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }} testID="oymo-guides">
      {lines.map((line) => {
        const strong = line.kind === 'axis';
        const dash = strong ? undefined : `${w(3)},${w(3)}`;
        return <GuidePair key={`${line.kind}-${line.value}`} value={line.value} size={size} width={w(strong ? 1.25 : 0.75)} halo={w(strong ? 2.5 : 1.75)} dash={dash} testID={line.kind === 'axis' ? 'oymo-guide-axis' : undefined} />;
      })}
      {settings.margins ? (
        <>
          <Rect x={SAFE_MARGIN} y={SAFE_MARGIN} width={size - SAFE_MARGIN * 2} height={size - SAFE_MARGIN * 2} fill="none" stroke={HALO} strokeWidth={w(2.5)} />
          <Rect x={SAFE_MARGIN} y={SAFE_MARGIN} width={size - SAFE_MARGIN * 2} height={size - SAFE_MARGIN * 2} fill="none" stroke={DARK} strokeWidth={w(1)} strokeDasharray={`${w(6)},${w(3)}`} testID="oymo-guide-margin" />
        </>
      ) : null}
      {activeX.map((x) => (
        <Line key={`ax-${x}`} x1={x} y1={0} x2={x} y2={size} stroke={ACTIVE} strokeWidth={w(2)} testID="oymo-guide-active" />
      ))}
      {activeY.map((y) => (
        <Line key={`ay-${y}`} x1={0} y1={y} x2={size} y2={y} stroke={ACTIVE} strokeWidth={w(2)} testID="oymo-guide-active" />
      ))}
    </Svg>
  );
}

/** One guide value on both axes (vertical and horizontal), halo first. */
function GuidePair({ value, size, width, halo, dash, testID }: { value: number; size: number; width: number; halo: number; dash?: string; testID?: string }) {
  return (
    <>
      <Line x1={value} y1={0} x2={value} y2={size} stroke={HALO} strokeWidth={halo} />
      <Line x1={0} y1={value} x2={size} y2={value} stroke={HALO} strokeWidth={halo} />
      <Line x1={value} y1={0} x2={value} y2={size} stroke={DARK} strokeWidth={width} strokeDasharray={dash} testID={testID} />
      <Line x1={0} y1={value} x2={size} y2={value} stroke={DARK} strokeWidth={width} strokeDasharray={dash} />
    </>
  );
}
