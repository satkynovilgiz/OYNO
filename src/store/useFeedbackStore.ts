import { create } from 'zustand';

export type FeedbackSource = 'settings' | 'error' | 'not_found';

export type FeedbackContext = {
  source: FeedbackSource;
  /** Sanitized crash id from RouteErrorBoundary - never a raw stack. */
  errorFingerprint?: string;
  /** Pre-selected category (a crash is a bug). */
  category?: 'bug';
};

type FeedbackState = {
  visible: boolean;
  context: FeedbackContext;
  open: (context: FeedbackContext) => void;
  close: () => void;
};

/** Opens the one Beta Feedback sheet (mounted at the root, over whatever
 * screen the tester is on - so "Attach current screen" means that screen). */
export const useFeedbackStore = create<FeedbackState>((set) => ({
  visible: false,
  context: { source: 'settings' },
  open: (context) => set({ visible: true, context }),
  close: () => set({ visible: false }),
}));
