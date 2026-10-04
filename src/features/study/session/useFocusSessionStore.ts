import { create } from 'zustand';

import type { FocusSession } from './focusSession';

/**
 * The current focus session - in memory only (a session is short; closing
 * the app ends it). It carries its owner: a different account or guest
 * never continues it (sessionFor), and the screen drops it on a switch.
 */
export const useFocusSessionStore = create<{ session: FocusSession | null; setSession: (session: FocusSession | null) => void }>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
}));
