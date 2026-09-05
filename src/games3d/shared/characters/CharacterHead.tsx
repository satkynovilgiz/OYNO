import { useFrame } from '@react-three/fiber';
import { forwardRef, useRef } from 'react';
import * as THREE from 'three';

import type { CharacterExpression, CharacterVariant } from './CharacterTypes';

type CharacterHeadProps = {
  variant: CharacterVariant;
  expression: CharacterExpression;
};

const EYE_X = 0.038;
const EYE_Y = 0.015;
const EYE_Z = 0.095;
const BLINK_MIN_INTERVAL_S = 2.5;
const BLINK_MAX_INTERVAL_S = 5;
const BLINK_DURATION_S = 0.12;

function Eye({ side }: { side: 1 | -1 }) {
  const lidRef = useRef<THREE.Group>(null);
  const nextBlinkAt = useRef(BLINK_MIN_INTERVAL_S + Math.random() * (BLINK_MAX_INTERVAL_S - BLINK_MIN_INTERVAL_S));
  const blinkStartedAt = useRef<number | null>(null);

  useFrame((state) => {
    if (!lidRef.current) return;
    const t = state.clock.elapsedTime;

    if (blinkStartedAt.current === null && t >= nextBlinkAt.current) {
      blinkStartedAt.current = t;
    }

    if (blinkStartedAt.current !== null) {
      const progress = (t - blinkStartedAt.current) / BLINK_DURATION_S;
      if (progress >= 1) {
        blinkStartedAt.current = null;
        nextBlinkAt.current = t + BLINK_MIN_INTERVAL_S + Math.random() * (BLINK_MAX_INTERVAL_S - BLINK_MIN_INTERVAL_S);
        lidRef.current.scale.y = 1;
      } else {
        // Close then reopen across the blink window (triangle envelope).
        const closeAmount = 1 - Math.sin(progress * Math.PI);
        lidRef.current.scale.y = Math.max(0.05, closeAmount);
      }
    }
  });

  return (
    <group ref={lidRef} position={[EYE_X * side, EYE_Y, EYE_Z]}>
      <mesh>
        <sphereGeometry args={[0.014, 10, 10]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.009]}>
        <sphereGeometry args={[0.007, 8, 8]} />
        <meshStandardMaterial color="#4A2E1A" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.014]}>
        <sphereGeometry args={[0.0035, 6, 6]} />
        <meshBasicMaterial color="#140E08" />
      </mesh>
    </group>
  );
}

/** Procedural stylized head/face (Section 4 - "not two black dots and one
 * line"): sclera+iris+pupil eyes with a self-contained ambient blink,
 * eyebrows, a nose, an expression-driven mouth, ears, and hair/headwear
 * matching `variant`. All primitive geometry (STYLIZED_PROTOTYPE, Section
 * 71) - no morph targets, since there's no GLB mesh to carry them
 * (Section 9: architecture is ready for real blend shapes later, not
 * simulating them now). */
export const CharacterHead = forwardRef<THREE.Group, CharacterHeadProps>(function CharacterHead({ variant, expression }, ref) {
  const isSmiling = expression === 'smile' || expression === 'celebrate';

  return (
    <group ref={ref}>
      {/* Skull */}
      <mesh scale={[1, 1.05, 0.92]} castShadow>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshStandardMaterial color={variant.skinTone} roughness={0.85} />
      </mesh>

      {/* Ears */}
      <mesh position={[0.105, -0.01, 0]} rotation={[0, 0.3, 0]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color={variant.skinTone} roughness={0.85} />
      </mesh>
      <mesh position={[-0.105, -0.01, 0]} rotation={[0, -0.3, 0]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color={variant.skinTone} roughness={0.85} />
      </mesh>

      <Eye side={1} />
      <Eye side={-1} />

      {/* Eyebrows */}
      <mesh position={[EYE_X, EYE_Y + 0.032, EYE_Z + 0.005]} rotation={[0, 0, -0.15]}>
        <boxGeometry args={[0.032, 0.007, 0.01]} />
        <meshStandardMaterial color={variant.hairColor} roughness={0.9} />
      </mesh>
      <mesh position={[-EYE_X, EYE_Y + 0.032, EYE_Z + 0.005]} rotation={[0, 0, 0.15]}>
        <boxGeometry args={[0.032, 0.007, 0.01]} />
        <meshStandardMaterial color={variant.hairColor} roughness={0.9} />
      </mesh>

      {/* Nose */}
      <mesh position={[0, -0.015, 0.108]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.018, 0.03, 4]} />
        <meshStandardMaterial color={variant.skinTone} roughness={0.85} />
      </mesh>

      {/* Mouth - expression swaps geometry rather than blending (no morph
          targets available); a wider/raised box reads as a small smile. */}
      <mesh position={[0, -0.058, 0.098]} scale={isSmiling ? [1.3, 1, 1] : [1, 1, 1]}>
        <boxGeometry args={[0.032, 0.008, 0.008]} />
        <meshStandardMaterial color="#8C4A42" roughness={0.7} />
      </mesh>
    </group>
  );
});
