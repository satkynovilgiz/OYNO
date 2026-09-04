import { scenePalette } from '../../shared/scenePalette';
import { JailooTerrain, KyrgyzSky, MountainBackdrop, SceneLighting } from '../../shared/environment';
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

      {[targetDistance * 0.33, targetDistance * 0.66].map((distance) => (
        <group key={distance} position={[1.6, 0, ARCHER_POSITION.z - distance]}>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.6, 6]} />
            <meshStandardMaterial color={scenePalette.wood} roughness={1} />
          </mesh>
        </group>
      ))}
    </>
  );
}
