import { useMemo } from 'react';
import * as THREE from 'three';

import { BozUy, JailooTerrain, KyrgyzSky, MountainBackdrop, SceneLighting } from '../../shared/environment';
import { scenePalette } from '../../shared/scenePalette';
import { FINISH_POSITION, TRACK_WAYPOINTS } from './KyzKuumaiTrack';

const TRAIL_WIDTH = 2.4;

function TrailSegment({ from, to }: { from: { x: number; z: number }; to: { x: number; z: number } }) {
  const { length, angle, midX, midZ } = useMemo(() => {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    return { length: Math.hypot(dx, dz), angle: Math.atan2(dx, dz), midX: (from.x + to.x) / 2, midZ: (from.z + to.z) / 2 };
  }, [from, to]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, angle]} position={[midX, 0.006, midZ]}>
      <planeGeometry args={[TRAIL_WIDTH, length]} />
      <meshStandardMaterial color={scenePalette.dirt} roughness={1} />
    </mesh>
  );
}

/** Kyz Kuumai's one polished course (Section 39) - a dirt trail following
 * TRACK_WAYPOINTS, flag posts at each checkpoint, and a couple of boz үйлөр
 * near the start/finish, on top of the shared jailoo backdrop. */
export function KyzKuumaiCourse() {
  return (
    <>
      <KyrgyzSky />
      <SceneLighting />
      <MountainBackdrop />
      <JailooTerrain size={220} />

      {TRACK_WAYPOINTS.slice(0, -1).map((point, i) => (
        <TrailSegment key={i} from={point} to={TRACK_WAYPOINTS[i + 1]} />
      ))}

      {TRACK_WAYPOINTS.map((point, i) => (
        <mesh key={i} position={[point.x + TRAIL_WIDTH / 2 + 0.3, 0.6, point.z]}>
          <cylinderGeometry args={[0.03, 0.03, 1.2, 6]} />
          <meshStandardMaterial color={i === TRACK_WAYPOINTS.length - 1 ? scenePalette.gold : scenePalette.wood} roughness={0.8} />
        </mesh>
      ))}

      <BozUy position={[-4, 0, 4]} />
      <BozUy position={[4, 0, FINISH_POSITION.z - 4]} />
    </>
  );
}
