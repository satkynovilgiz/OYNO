import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** Dev-only FPS overlay (Section "development-only FPS counter") - counts
 * frames via `requestAnimationFrame`, independent of react-three-fiber's
 * own render loop, so it works as a plain RN sibling overlay without
 * needing to live inside any `<Canvas>` tree or touch any game/graphics
 * code. Mounted once in `core/Game3DCanvas.tsx` (the one host every 3D
 * game already renders through), so all 5 games get it for free with zero
 * per-game wiring.
 *
 * Gated on `__DEV__` (React Native's standard dev/production flag, `false`
 * in a release JS bundle) - the component renders nothing at all rather
 * than being merely hidden, so it costs zero in production, not just
 * "invisible." The sampling itself is throttled to 2 updates/sec (a plain
 * counter increment every frame, a `setState` only every ~500ms), so it
 * doesn't add a React re-render per rendered frame the way naively calling
 * `setState` every tick would. */
export function FpsCounter() {
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);
  const lastSampleAtRef = useRef(Date.now());
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!__DEV__) return undefined;

    const tick = () => {
      frameCountRef.current += 1;
      const now = Date.now();
      const elapsed = now - lastSampleAtRef.current;
      if (elapsed >= 500) {
        setFps(Math.round((frameCountRef.current * 1000) / elapsed));
        frameCountRef.current = 0;
        lastSampleAtRef.current = now;
      }
      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  if (!__DEV__) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <Text style={styles.text}>{fps} FPS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 52,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 9999,
  },
  text: {
    color: '#4AE24A',
    fontSize: 11,
    fontWeight: '700',
  },
});
