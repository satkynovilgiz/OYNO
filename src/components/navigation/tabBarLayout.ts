import { create } from 'zustand';

/** The bottom tab bar's measured height (without the safe-area inset), so
 * floating UI such as the audio mini player can sit just above it. */
export const useTabBarLayout = create<{ height: number; setHeight: (height: number) => void }>((set) => ({
  height: 64,
  setHeight: (height) => set({ height }),
}));
