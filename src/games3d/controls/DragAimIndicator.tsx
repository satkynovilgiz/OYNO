import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import * as THREE from 'three';

const MAX_PULL_PX = 140;
const MAX_ANGLE_RAD = 0.6;

type DragAimIndicatorProps = {
  pullX: SharedValue<number>;
  pullY: SharedValue<number>;
  isPulling: SharedValue<boolean>;
  getLaunchPosition: (angleOffset: number) => { x: number; z: number };
  color: string;
  maxLength?: number;
};

/** Shared direction+power line for DragPowerController games (Ordo, Chuko)
 * (Section "ORDO — AIM": direction + power only, no collision prediction).
 * Reads shared values directly in useFrame so dragging never triggers a
 * React re-render. */
export function DragAimIndicator({ pullX, pullY, isPulling, getLaunchPosition, color, maxLength = 1.6 }: DragAimIndicatorProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const visible = isPulling.value && pullY.value > 4;
    groupRef.current.visible = visible;
    if (!visible) return;

    const angleOffset = Math.max(-1, Math.min(1, pullX.value / MAX_PULL_PX)) * MAX_ANGLE_RAD;
    const power = Math.max(0, Math.min(1, pullY.value / MAX_PULL_PX));
    const launch = getLaunchPosition(angleOffset);

    groupRef.current.position.set(launch.x, 0.05, launch.z);
    groupRef.current.rotation.y = -(Math.PI + angleOffset);
    groupRef.current.scale.set(1, 1, 0.4 + power);
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh position={[0, 0, -maxLength / 2]}>
        <boxGeometry args={[0.04, 0.02, maxLength]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}
