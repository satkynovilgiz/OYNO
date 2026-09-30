import { create } from 'zustand';

import type { FeedbackCategory } from '@/services/feedback/feedbackQueue';
import type { ReportContentType } from '@/services/feedback/reportContent';

export type FeedbackSource = 'settings' | 'error' | 'not_found' | 'content';

export type FeedbackContext = {
  source: FeedbackSource;
  /** Sanitized crash id from RouteErrorBoundary - never a raw stack. */
  errorFingerprint?: string;
  /** Pre-selected category (a crash is a bug; a content report a correction). */
  category?: FeedbackCategory;
  /** The content a "Report an issue" link was on - its public id is sent,
   * its title is only shown in the sheet so the reporter needn't retype it. */
  content?: { contentType: ReportContentType; contentId: string; title: string };
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
