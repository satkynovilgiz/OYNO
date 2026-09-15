import { scenePalette } from '../../shared/scenePalette';
import { Bush, Flag, JailooTerrain, KyrgyzSky, MountainBackdrop, RockCluster, SceneLighting } from '../../shared/environment';
import { ARCHER_POSITION } from './JaaAtuuBallistics';

type ArcheryRangeProps = {
  targetDistance: number;
};

/** Jaa Atuu's own environment dressing on top of the shared jailoo pieces
 * (Section "Do not make every game visually identical") - a dirt shooting
 * lane and a couple of distance-marker posts, sized to the active
 * difficulty's target distance. */
export function ArcheryRange({ targetDistance }: ArcheryRangeProps) {
  const laneLength = targetDistance + 2;

  return (
    <>
      <KyrgyzSky />
      <SceneLighting />
      <MountainBackdrop />
      <JailooTerrain />

      <mesh position={[ARCHER_POSITION.x, 0.01, ARCHER_POSITION.z - laneLength / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.2, laneLength]} />
        <meshStandardMaterial color={scenePalette.dirt} roughness={1} />
      </mesh>

      {[targetDistance * 0.33, targetDistance * 0.66].map((distance, i) => (
        <Flag
          key={distance}
          position={[1.6, 0, ARCHER_POSITION.z - distance]}
          height={0.7}
          color={scenePalette.terracotta}
          phase={i * 1.7}
        />
      ))}

      {/* Sideline dressing (Section "small paths" / "rocks" / "simple
       * vegetation") - kept well outside the dirt lane so it never overlaps
       * an arrow's flight path; purely cosmetic, gameplay untouched. */}
      <RockCluster position={[-4.5, 0, ARCHER_POSITION.z - laneLength * 0.4]} seed={5} count={3} />
      <RockCluster position={[4.2, 0, ARCHER_POSITION.z - laneLength * 0.75]} seed={9} count={4} />
      <Bush position={[-3.4, 0, ARCHER_POSITION.z - laneLength * 0.15]} seed={2} />
      <Bush position={[3.6, 0, ARCHER_POSITION.z - laneLength * 0.55]} seed={6} scale={1.2} />
    </>
  );
}
