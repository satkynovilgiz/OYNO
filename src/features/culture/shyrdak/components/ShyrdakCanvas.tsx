import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { computeMirroredPoints, type SymmetryMode } from '@/services/culture/symmetry';
import { colors, radii } from '@/theme';

import { getShyrdakPatternShape } from '../patterns';

export const CANVAS_WIDTH = 280;
export const CANVAS_HEIGHT = 140;
const MEDALLION_SIZE = 110;
const MEDALLION_ORIGIN_X = (CANVAS_WIDTH - MEDALLION_SIZE) / 2;
const MEDALLION_ORIGIN_Y = (CANVAS_HEIGHT - MEDALLION_SIZE) / 2;
// Anchored off-center (not at the medallion's exact center point) -
// computeMirroredPoints reflects a point across the center, so a point AT
// the center always mirrors onto itself no matter the symmetry mode,
// which would make the Симметрия control a dead no-op. An off-center
// anchor is what actually produces the repeating medallion look.
const PATTERN_ANCHOR = { x: MEDALLION_SIZE * 0.28, y: MEDALLION_SIZE * 0.28 };

type ShyrdakCanvasProps = {
  baseColor: string;
  secondaryColor: string;
  patternId: string;
  borderEnabled: boolean;
  symmetryMode: SymmetryMode;
};

/** Live preview only, no tap-to-place - a single pattern piece mirrored
 * around a centered "medallion" area, matching how a real шырдак's central
 * design actually works (a repeating/mirrored motif, not a free
 * composition). Reuses the exact same computeMirroredPoints Oymo uses,
 * just anchored to the medallion's own local coordinate space. */
export function ShyrdakCanvas({ baseColor, secondaryColor, patternId, borderEnabled, symmetryMode }: ShyrdakCanvasProps) {
  const { t } = useTranslation();
  const Shape = getShyrdakPatternShape(patternId);
  const points = computeMirroredPoints(PATTERN_ANCHOR, symmetryMode, MEDALLION_SIZE);

  return (
    <View
      style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: baseColor }}
      accessibilityLabel={t('culture.shyrdak.canvasLabel')}
      accessibilityRole="image"
    >
      <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT} viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}>
        {borderEnabled && (
          <>
            <Rect x={4} y={4} width={CANVAS_WIDTH - 8} height={CANVAS_HEIGHT - 8} rx={6} fill="none" stroke={colors.textPrimary} strokeWidth={4} />
            <Rect x={11} y={11} width={CANVAS_WIDTH - 22} height={CANVAS_HEIGHT - 22} rx={4} fill="none" stroke={colors.textOnDark} strokeWidth={3} />
          </>
        )}
      </Svg>

      {points.map((point, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: MEDALLION_ORIGIN_X + point.x - 20,
            top: MEDALLION_ORIGIN_Y + point.y - 20,
          }}
        >
          <Shape size={40} color={secondaryColor} />
        </View>
      ))}
    </View>
  );
}
