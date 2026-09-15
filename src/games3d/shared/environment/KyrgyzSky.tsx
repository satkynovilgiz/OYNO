import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { scenePalette } from '../scenePalette';

type CloudSpec = { x: number; y: number; z: number; scale: number; speed: number };

/** A handful of drifting cloud puffs (Section "better sky") - each puff is
 * 3 flattened, overlapping spheres (same low-poly-cluster trick as
 * Bush/Rock) rather than a billboard texture, so no image asset is needed
 * and licensing never comes up. Drift is a single looping X-position lerp
 * in useFrame - cheap, and "subtle environmental movement where cheap" per
 * the task brief. Deterministic layout (Section: no Math.random). */
function Clouds() {
  const groupRef = useRef<THREE.Group>(null);

  const clouds = useMemo<CloudSpec[]>(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const wobble = Math.sin(i * 12.9898 + 41.7) * 0.5 + 0.5;
      return {
        x: (i - 2) * 22 + wobble * 8,
        y: 18 + wobble * 6,
        z: -60 - wobble * 20,
        scale: 3 + wobble * 2,
        speed: 0.15 + wobble * 0.1,
      };
    });
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      const spec = clouds[i];
      if (!spec) return;
      const span = 70;
      child.position.x = spec.x + ((state.clock.elapsedTime * spec.speed * 4) % span) - span / 2;
    });
  });

  return (
    <group ref={groupRef}>
      {clouds.map((cloud, i) => (
        <group key={i} position={[cloud.x, cloud.y, cloud.z]} scale={cloud.scale}>
          <mesh position={[-0.6, 0, 0]} scale={[1, 0.6, 0.9]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial color={scenePalette.cloud} fog={false} />
          </mesh>
          <mesh position={[0.5, 0.15, 0]} scale={[1.1, 0.65, 0.9]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial color={scenePalette.cloud} fog={false} />
          </mesh>
          <mesh position={[0, -0.1, 0.1]} scale={[1.3, 0.5, 0.9]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial color={scenePalette.cloud} fog={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Cheap stylized sky dome (Section 10/59) - a two-color vertical gradient
 * baked into vertex colors on a large inverted sphere, plus scene fog for
 * depth. Deliberately not a physically-based sky shader: this is placeholder
 * geometry (Section 12) chosen for mobile GPU cost, not realism. */
export function KyrgyzSky() {
  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(90, 24, 16);
    const top = new THREE.Color(scenePalette.skyTop);
    const horizon = new THREE.Color(scenePalette.skyHorizon);
    const colors: number[] = [];
    const position = geo.attributes.position;

    for (let i = 0; i < position.count; i += 1) {
      const y = position.getY(i);
      const t = THREE.MathUtils.clamp(y / 90, -0.15, 1);
      const mixed = horizon.clone().lerp(top, Math.max(0, t));
      colors.push(mixed.r, mixed.g, mixed.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, []);

  return (
    <>
      <fog attach="fog" args={[scenePalette.skyHorizon, 40, 110]} />
      <mesh geometry={geometry}>
        <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} />
      </mesh>
      <Clouds />
    </>
  );
}
