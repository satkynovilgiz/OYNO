import { Canvas } from '@react-three/fiber';
import { type ReactNode, Suspense, useCallback } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { FpsCounter } from '../ui/FpsCounter';

const SCENE_FADE_IN_MS = 220;

type Game3DCanvasProps = {
  children: ReactNode;
  /** Stops the render loop without unmounting the scene, so a backgrounded
   * or user-paused game costs ~0 GPU/CPU (Section 17) without paying to
   * recreate the GL context on every resume. */
  isPaused: boolean;
};

/** Shared 3D rendering host (Section 7). @react-three/fiber resolves to its
 * React Native build automatically (via expo-gl) because Metro honors the
 * package's "react-native" field - no separate native import path needed.
 * Unmounting this component disposes the renderer/scene/GL context; every
 * game screen must unmount it on exit rather than just hiding it, or the GL
 * context leaks (Section 65).
 *
 * The Suspense fallback here is intentionally `null`, not a caller-supplied
 * React Native component: everything inside `<Canvas>` is reconciled by
 * react-three-fiber's own renderer, which only understands Three.js objects
 * (mesh, group, ...) - mounting a RN `<View>`/`<Text>` here would crash. A
 * game whose scene suspends (e.g. `useGLTF`) should drive a normal RN
 * `LoadingOverlay` as a sibling of `Game3DCanvas`, using drei's
 * `useProgress` (a global store, safe to read outside the Canvas tree), not
 * through this fallback. */
export function Game3DCanvas({ children, isPaused }: Game3DCanvasProps) {
  // Starts fully transparent and fades in once `onCreated` fires (Section
  // "Add a smooth fade-in when the 3D scene becomes ready" / "Prevent the
  // player from briefly seeing an empty/unfinished scene") - `onCreated` is
  // R3F's own signal that the GL context/renderer exist and the scene is
  // about to render its first frame, not a guessed timeout, so this covers
  // the brief black/empty flash a fresh GL surface can show before its
  // first paint, for all 5 games uniformly (none of them need their own
  // copy of this - it lives once, here, in the one Canvas host every game
  // already renders through).
  const sceneOpacity = useSharedValue(0);
  const sceneStyle = useAnimatedStyle(() => ({ opacity: sceneOpacity.value }));
  const handleCreated = useCallback(() => {
    sceneOpacity.value = withTiming(1, { duration: SCENE_FADE_IN_MS });
  }, [sceneOpacity]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, sceneStyle]}>
        <Canvas
          onCreated={handleCreated}
          frameloop={isPaused ? 'never' : 'always'}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          dpr={Math.min(2, PixelRatio.get())}
          camera={{ fov: 55, near: 0.1, far: 200, position: [0, 1.6, 4] }}
          // react-three-fiber's <Canvas> defaults `shadows` to false (leaves
          // gl.shadowMap.enabled off) unless set here - every game's
          // castShadow/receiveShadow/shadow-camera-* config (SceneLighting,
          // JailooTerrain, CharacterModel, HorseModel, ...) had been a no-op
          // this whole time as a result. "soft" = PCFSoftShadowMap, the
          // softer-edged filter this polish pass asked for, at the same
          // 1024^2 map size/bounds already budgeted in SceneLighting.tsx -
          // not a new cost class, but real device FPS should be re-checked
          // now that shadows actually render (see docs/3D_GAMES.md).
          shadows="soft"
        >
          <Suspense fallback={null}>{children}</Suspense>
        </Canvas>
      </Animated.View>
      <FpsCounter />
    </View>
  );
}
