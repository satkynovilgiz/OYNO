/**
 * The 3-2-1-GO countdown's timers, ALL owned by one cancel function.
 * Previously the final `onDone` timer was created inside the last step's
 * timer and never cleared: pausing (which hides the countdown) or leaving
 * the game during the last step still fired `onDone` afterwards - starting
 * the round while paused, or calling into an unmounted game.
 */
export function scheduleCountdown(stepCount: number, stepMs: number, onStep: (index: number) => void, onDone: () => void): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let cancelled = false;
  for (let i = 0; i < stepCount; i += 1) {
    timers.push(
      setTimeout(() => {
        if (cancelled) return;
        onStep(i);
        if (i === stepCount - 1)
          timers.push(
            setTimeout(() => {
              if (!cancelled) onDone();
            }, stepMs),
          );
      }, i * stepMs),
    );
  }
  return () => {
    cancelled = true;
    timers.forEach(clearTimeout);
  };
}
