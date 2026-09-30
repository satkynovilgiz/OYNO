import { useAuthStore } from '@/store/useAuthStore';

import { useAudioGuideStore } from './useAudioGuideStore';

/**
 * Narration belongs to the person who started it: when the account changes
 * (sign-out, sign-in, switching accounts, session lost) the active
 * narration stops, so the mini player never carries account A's listening
 * into a guest session or account B. Returns the unsubscribe function.
 */
export function bindAudioToAccount(): () => void {
  let owner = useAuthStore.getState().user?.id ?? null;
  return useAuthStore.subscribe((state) => {
    const next = state.user?.id ?? null;
    if (next === owner) return;
    owner = next;
    useAudioGuideStore.getState().stop();
  });
}
