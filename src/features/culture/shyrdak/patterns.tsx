import { type ComponentType } from 'react';
import Svg, { Path } from 'react-native-svg';

export type ShyrdakPatternShapeProps = { size?: number; color?: string };

/**
 * Original, bold solid shapes - шырдак patterns are cut from solid felt
 * (not carved line art like Oymo's wood-carving motifs), so these render
 * filled rather than stroked. NOT reproductions of any verified
 * traditional pattern (none exists in the project); only the NAMES are
 * sourced, from the verified `culture_items` row `shyrdak-craft`
 * (fun_facts field: ит куйругу / dog tail, тоо теке мүйүзү / mountain
 * goat horn, куш тырмагы / bird claw -
 * 20260829000005_boz_uy_oymo_shyrdak_content.sql). Same "verified name,
 * original shape" disclosure as src/features/culture/oymo/motifs.tsx.
 */
function ItKuirukShape({ size = 40, color = '#7A3226' }: ShyrdakPatternShapeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Path
        d="M20 2 C26 8 30 14 26 20 C30 26 26 32 20 38 C14 32 10 26 14 20 C10 14 14 8 20 2Z"
        fill={color}
      />
    </Svg>
  );
}

function TooTekeMuyuzuShape({ size = 40, color = '#7A3226' }: ShyrdakPatternShapeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Path
        d="M20 38 C10 34 6 24 12 16 C8 12 10 4 18 2 C16 8 18 12 22 14 C28 18 28 26 22 32 C24 34 22 37 20 38Z"
        fill={color}
      />
    </Svg>
  );
}

function KushTyrmagyShape({ size = 40, color = '#7A3226' }: ShyrdakPatternShapeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Path d="M20 38 L20 18" stroke={color} strokeWidth={6} strokeLinecap="round" />
      <Path d="M20 18 L8 4 L14 2 L20 12 L26 2 L32 4 Z" fill={color} />
    </Svg>
  );
}

export type ShyrdakPatternId = 'itKuiruk' | 'tooTekeMuyuzu' | 'kushTyrmagy';

export type ShyrdakPattern = {
  id: ShyrdakPatternId;
  nameKey: string;
  Shape: ComponentType<ShyrdakPatternShapeProps>;
};

export const SHYRDAK_PATTERNS: readonly ShyrdakPattern[] = [
  { id: 'itKuiruk', nameKey: 'culture.shyrdak.patterns.itKuiruk', Shape: ItKuirukShape },
  { id: 'tooTekeMuyuzu', nameKey: 'culture.shyrdak.patterns.tooTekeMuyuzu', Shape: TooTekeMuyuzuShape },
  { id: 'kushTyrmagy', nameKey: 'culture.shyrdak.patterns.kushTyrmagy', Shape: KushTyrmagyShape },
] as const;

export function getShyrdakPatternShape(patternId: string): ComponentType<ShyrdakPatternShapeProps> {
  return SHYRDAK_PATTERNS.find((p) => p.id === patternId)?.Shape ?? SHYRDAK_PATTERNS[0].Shape;
}
