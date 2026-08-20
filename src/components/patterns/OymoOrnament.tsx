import Svg, { Circle, Path } from 'react-native-svg';

type OymoOrnamentProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

/**
 * Original nested-diamond knot motif inspired by Kyrgyz oymo/shyrdak
 * lattice ornaments. Purely geometric — not a reproduction of any existing
 * brand mark or traditional pattern.
 */
export function OymoOrnament({ size = 24, color = '#2F5233', strokeWidth = 1.5 }: OymoOrnamentProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2 L22 12 L12 22 L2 12 Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M12 7.5 L16.5 12 L12 16.5 L7.5 12 Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={1.4} fill={color} />
    </Svg>
  );
}
