import * as THREE from 'three';

import type { CharacterVariant } from './CharacterTypes';

type CharacterHairProps = {
  variant: CharacterVariant;
};

/** Hair + optional traditional-inspired headwear (Section 5/6) - a felt
 * kalpak or a white elechek wrap, both stylized/simplified, not tied to
 * `gender` so any variant can wear either. Cultural identity lives here and
 * in clothing, not in face shape (Section 5). */
export function CharacterHair({ variant }: CharacterHairProps) {
  const showFullHair = !variant.wearsKalpak && !variant.wearsElechek;

  return (
    <group>
      {showFullHair && variant.hairStyle !== 'covered' ? (
        <mesh position={[0, 0.04, -0.01]} scale={[1.03, 0.85, 1.05]}>
          <sphereGeometry args={[0.112, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <meshStandardMaterial color={variant.hairColor} roughness={0.7} side={THREE.DoubleSide} />
        </mesh>
      ) : (
        // 'covered' or hat/wrap-wearing variants still show a thin hair
        // band at the sides/back so the headwear doesn't look glued onto a
        // bald head.
        <mesh position={[0, 0.0, -0.02]} scale={[1.02, 0.7, 1.02]}>
          <sphereGeometry args={[0.111, 16, 12, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.4]} />
          <meshStandardMaterial color={variant.hairColor} roughness={0.7} side={THREE.DoubleSide} />
        </mesh>
      )}

      {variant.hairStyle === 'braid' && !variant.wearsElechek ? (
        <mesh position={[0, -0.12, -0.09]} rotation={[0.3, 0, 0]}>
          <cylinderGeometry args={[0.014, 0.01, 0.22, 8]} />
          <meshStandardMaterial color={variant.hairColor} roughness={0.7} />
        </mesh>
      ) : null}

      {variant.wearsKalpak ? (
        <group position={[0, 0.1, 0]}>
          <mesh>
            <cylinderGeometry args={[0.115, 0.125, 0.05, 16]} />
            <meshStandardMaterial color="#2B2019" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <coneGeometry args={[0.11, 0.12, 16]} />
            <meshStandardMaterial color="#F3E5C9" roughness={0.9} />
          </mesh>
        </group>
      ) : null}

      {variant.wearsElechek ? (
        <group position={[0, 0.08, 0]}>
          <mesh>
            <sphereGeometry args={[0.128, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            <meshStandardMaterial color="#F8F3E8" roughness={0.85} />
          </mesh>
          <mesh position={[0, -0.02, 0]}>
            <torusGeometry args={[0.118, 0.02, 8, 20]} />
            <meshStandardMaterial color="#F8F3E8" roughness={0.85} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}
