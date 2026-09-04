import { Canvas } from '@react-three/fiber';
import { type ReactNode, Suspense } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';

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
  return (
    <View style={StyleSheet.absoluteFill}>
      <Canvas
        frameloop={isPaused ? 'never' : 'always'}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={Math.min(2, PixelRatio.get())}
        camera={{ fov: 55, near: 0.1, far: 200, position: [0, 1.6, 4] }}
      >
        <Suspense fallback={null}>{children}</Suspense>
      </Canvas>
    </View>
  );
}
