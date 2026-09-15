import { useMemo } from 'react';
import * as THREE from 'three';

import { scenePalette } from '../scenePalette';

type RockClusterProps = {
  position: [number, number, number];
  /** Deterministic pseudo-variation seed (Section: no Math.random - see
   * MountainBackdrop.tsx's identical reasoning) so the scatter is stable
   * across renders/re-mounts instead of reshuffling every time. */
  seed?: number;
  count?: number;
};

/** A handful of low-poly rocks (Section "rocks") - icosahedrons with no
 * subdivision are as cheap as primitive geometry gets (12 triangles each)
 * while still reading as angular stone rather than a smooth ball. Scatters
 * `count` of them in a small cluster around `position`. */
export function RockCluster({ position, seed = 0, count = 3 }: RockClusterProps) {
  const rocks = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const wobble = Math.sin(i * 12.9898 + seed * 78.233) * 0.5 + 0.5;
      const angle = (i / count) * Math.PI * 2 + wobble;
      const radius = 0.5 + wobble * 0.9;
      const size = 0.18 + wobble * 0.22;
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        size,
        rotation: wobble * Math.PI * 2,
        tone: wobble > 0.5 ? scenePalette.mountainMid : scenePalette.mountainNear,
      };
    });
  }, [seed, count]);

  return (
    <group position={position}>
      {rocks.map((rock, i) => (
        <mesh key={i} position={[rock.x, rock.size * 0.4, rock.z]} rotation={[0, rock.rotation, rock.rotation * 0.4]} castShadow receiveShadow>
          <icosahedronGeometry args={[rock.size, 0]} />
          <meshStandardMaterial color={rock.tone} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}
