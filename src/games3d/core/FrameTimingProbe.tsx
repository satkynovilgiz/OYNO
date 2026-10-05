import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

import { devFrameStats, formatFrameStats, FrameRecorder } from './frameStats';

/**
 * Dev-only frame-timing probe, rendered INSIDE the game's Canvas so it
 * samples the real render loop (see frameStats.ts for the method). It
 * records only while `active` (gameplay) and prints a summary to the dev
 * console each time gameplay stops (pause, result, exit). Never mounted in
 * a release bundle (Game3DCanvas gates it on __DEV__).
 */
export function FrameTimingProbe({ gameId, active }: { gameId: string; active: boolean }) {
  const recorder = useRef<FrameRecorder | null>(null);
  if (!recorder.current) recorder.current = new FrameRecorder();

  useEffect(() => {
    recorder.current!.setActive(active);
    if (!active) report();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Exit: final summary for this session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => report(), []);

  useFrame((_state, delta) => recorder.current!.frame(delta));

  function report() {
    const summary = recorder.current!.summary();
    if (summary.frames === 0) return;
    devFrameStats.set(gameId, summary);
    // eslint-disable-next-line no-console
    console.info(formatFrameStats(gameId, summary));
  }
  return null;
}
