import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

import type { BozUyStepId } from '@/services/culture/bozUySteps';

type BozUyPartIllustrationProps = {
  stepId: BozUyStepId;
  size?: number;
};

/**
 * Original, simple line-art per structural part - NOT a reproduction of
 * any specific reference photo/illustration (none exists in the project
 * for per-step Boz Üy assembly art). Flagged in the final report as a
 * real-illustration gap: the premium painterly step art from the design
 * reference would meaningfully improve this and should replace these
 * placeholders once available.
 */
export function BozUyPartIllustration({ stepId, size = 120 }: BozUyPartIllustrationProps) {
  const stroke = colors.accentBrown;

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      {stepId === 'kerege' && (
        <>
          {[0, 20, 40, 60, 80, 100].map((x) => (
            <Line key={`d${x}`} x1={x} y1={10} x2={x + 20} y2={110} stroke={stroke} strokeWidth={3} />
          ))}
          {[0, 20, 40, 60, 80, 100].map((x) => (
            <Line key={`a${x}`} x1={x + 20} y1={10} x2={x} y2={110} stroke={stroke} strokeWidth={3} />
          ))}
        </>
      )}
      {stepId === 'uuk' && (
        <>
          <Circle cx={60} cy={20} r={6} stroke={stroke} strokeWidth={3} />
          {[-50, -30, -10, 10, 30, 50].map((dx) => (
            <Line key={dx} x1={60} y1={20} x2={60 + dx} y2={110} stroke={stroke} strokeWidth={3} />
          ))}
        </>
      )}
      {stepId === 'tunduk' && (
        <>
          <Circle cx={60} cy={60} r={45} stroke={stroke} strokeWidth={4} />
          <Circle cx={60} cy={60} r={22} stroke={stroke} strokeWidth={3} />
          <Line x1={60} y1={15} x2={60} y2={38} stroke={stroke} strokeWidth={3} />
          <Line x1={60} y1={82} x2={60} y2={105} stroke={stroke} strokeWidth={3} />
          <Line x1={15} y1={60} x2={38} y2={60} stroke={stroke} strokeWidth={3} />
          <Line x1={82} y1={60} x2={105} y2={60} stroke={stroke} strokeWidth={3} />
        </>
      )}
      {stepId === 'bosogo' && (
        <>
          <Rect x={30} y={15} width={60} height={95} rx={4} stroke={stroke} strokeWidth={4} />
          <Path d="M60 15 V110 M30 60 H90" stroke={stroke} strokeWidth={2} />
          <Circle cx={72} cy={62} r={3} fill={stroke} />
        </>
      )}
    </Svg>
  );
}
