import { scenePalette } from '../scenePalette';

/** One main directional light (sun) + soft hemisphere fill (Section 58) -
 * deliberately no extra point lights. Shadows are enabled only on the
 * directional light and only meant to be cast by important objects
 * (target, arrows) that opt in with `castShadow`, not the terrain itself
 * (Section 57). */
export function SceneLighting() {
  return (
    <>
      <hemisphereLight args={[scenePalette.skyTop, scenePalette.grassShadow, 0.65]} />
      <directionalLight
        position={[18, 24, 10]}
        intensity={1.6}
        color="#FFF3D6"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
    </>
  );
}
