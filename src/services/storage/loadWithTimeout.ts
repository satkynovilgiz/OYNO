/**
 * Runs `task` (which is expected to already catch its own errors - this
 * isn't a replacement for that) and guarantees `onSettled` fires exactly
 * once: either when `task` finishes, or after `timeoutMs`, whichever comes
 * first. The app's boot sequence (`index.tsx`, `_layout.tsx`) both gate
 * routing on a load like this - a stuck native call (not a thrown error,
 * an actual hang) must not be able to strand the user on the splash screen
 * with literally no path forward. Returns a cleanup function that cancels
 * the timeout.
 */
export function loadWithTimeout(task: () => Promise<void>, onSettled: () => void, timeoutMs = 8000): () => void {
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    onSettled();
  };

  void task().then(finish, finish);
  const timer = setTimeout(finish, timeoutMs);
  return () => clearTimeout(timer);
}
