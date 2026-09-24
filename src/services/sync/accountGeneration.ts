import { useAuthStore } from '@/store/useAuthStore';

/**
 * THE account-session generation - one counter for the whole app, used by
 * the sync engine and by every async progress action.
 *
 * A generation identifies one signed-in SESSION, not just a user id:
 * "Account A, session #1" and "Account A, session #2" (after signing out
 * and back in) have different generations. It changes:
 *   - whenever the auth status or signed-in user changes (sign in, sign out,
 *     session lost, account switch) - see the auth subscription below;
 *   - explicitly via `bumpAccountGeneration()` BEFORE account-state cleanup
 *     (sign-out, session lost, account deletion, switching accounts), so
 *     nothing started earlier can apply its result after the cleanup.
 *
 * Pattern: capture a token before the async work; after every await (and
 * before every local mutation) check `isAccountGenerationCurrent(token)`.
 * A stale result then performs ZERO local mutations.
 */

export type AccountGenerationToken = { userId: string | null; generation: number };

let generation = 0;

export function bumpAccountGeneration(): void {
  generation += 1;
}

function signedInUserId(): string | null {
  const { status, user } = useAuthStore.getState();
  return status === 'authenticated' && user?.id ? user.id : null;
}

/** The current session (`userId` null = guest / signed out). */
export function captureAccountGeneration(): AccountGenerationToken {
  return { userId: signedInUserId(), generation };
}

/** True only while the same session that captured `token` is still active. */
export function isAccountGenerationCurrent(token: AccountGenerationToken): boolean {
  return token.generation === generation && token.userId === signedInUserId();
}

// Every sign-in/sign-out/user change starts a new generation automatically,
// even if a code path forgets to bump explicitly. (Tests may replace the
// auth store with a plain object that has no subscribe.)
const store = useAuthStore as unknown as { subscribe?: (listener: (state: { status: string; user: { id?: string } | null }, previous: { status: string; user: { id?: string } | null }) => void) => void };
store.subscribe?.((state, previous) => {
  if (state.status !== previous.status || state.user?.id !== previous.user?.id) bumpAccountGeneration();
});
