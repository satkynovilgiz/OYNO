import { useMemo } from 'react';
import * as THREE from 'three';

import { BozUy, Bush, Flag, JailooTerrain, KyrgyzSky, MountainBackdrop, RockCluster, SceneLighting } from '../../shared/environment';
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
        <Flag
          key={i}
          position={[point.x + TRAIL_WIDTH / 2 + 0.3, 0, point.z]}
          height={1.2}
          color={i === TRACK_WAYPOINTS.length - 1 ? scenePalette.gold : scenePalette.terracotta}
          phase={i * 1.1}
        />
      ))}

      <BozUy position={[-4, 0, 4]} />
      <BozUy position={[4, 0, FINISH_POSITION.z - 4]} />

      {/* Sparse rocks/scrub off to the sides of the trail (Section
       * "rocks" / "simple vegetation") - kept clear of TRACK_WAYPOINTS and
       * the dirt trail itself so the riding line and checkpoints are
       * untouched; purely dressing for the open mountain track's identity. */}
      {TRACK_WAYPOINTS.slice(1, -1).map((point, i) => (
        <RockCluster
          key={i}
          position={[point.x - TRAIL_WIDTH / 2 - 1.4, 0, point.z + (i % 2 === 0 ? 2 : -2)]}
          seed={i + 12}
          count={2}
        />
      ))}
      <Bush position={[-6, 0, -6]} seed={13} scale={1.2} />
      <Bush position={[6, 0, FINISH_POSITION.z - 8]} seed={17} />
    </>
  );
}
