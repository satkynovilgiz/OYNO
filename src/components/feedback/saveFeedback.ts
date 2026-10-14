/**
 * Save feedback that follows the REAL result (docs/INTERACTION_FEEDBACK.md).
 *
 *   idle -> saving -> saved   (only when the write said it succeeded)
 *                  -> failed  (the write failed or threw)
 *   saved fades back to idle after SAVED_VISIBLE_MS; failed stays until the
 *   next attempt.
 *
 * Every attempt gets a sequence number: a slower, older attempt that
 * finishes after a newer one can never overwrite the newer state (so rapid
 * taps can't leave "Saved" on top of a failure, or "Saving" stuck).
 */
export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';
export const SAVED_VISIBLE_MS = 2500;

export type SaveMachine = { state: SaveState; seq: number };
export const INITIAL: SaveMachine = { state: 'idle', seq: 0 };

export function begin(machine: SaveMachine): SaveMachine {
  return { state: 'saving', seq: machine.seq + 1 };
}
/** The result of attempt `seq`; ignored if a newer attempt has started. */
export function settle(machine: SaveMachine, seq: number, ok: boolean): SaveMachine {
  return seq === machine.seq ? { state: ok ? 'saved' : 'failed', seq } : machine;
}
/** The "saved" message has been seen: back to idle (only if nothing newer happened). */
export function expire(machine: SaveMachine, seq: number): SaveMachine {
  return seq === machine.seq && machine.state === 'saved' ? { state: 'idle', seq } : machine;
}
