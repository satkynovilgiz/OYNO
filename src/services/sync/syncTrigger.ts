/**
 * The seam stores use to say "account state changed, sync when you can"
 * without importing the sync engine (which imports the stores - that
 * would be a cycle). The engine registers itself here; until it does
 * (tests, first boot frames) a request is a harmless no-op.
 */
export type SyncReason = 'app_start' | 'sign_in' | 'reconnect' | 'foreground' | 'local_change' | 'sign_out';

type Scheduler = (reason: SyncReason) => void;

let scheduler: Scheduler | null = null;
let accountProbe: () => string | null = () => null;

/** `signedInAccountId` returns the signed-in user id, or null for a guest. */
export function registerSyncScheduler(next: Scheduler | null, signedInAccountId?: () => string | null): void {
  scheduler = next;
  if (signedInAccountId) accountProbe = signedInAccountId;
}

/** The signed-in account id, or null (guest / not known yet). */
export function currentAccountId(): string | null {
  return accountProbe();
}

/** Who made a local edit - decides the guest -> account merge rule. */
export function currentEditOrigin(): 'guest' | 'account' {
  return accountProbe() ? 'account' : 'guest';
}

export function requestAccountSync(reason: SyncReason): void {
  scheduler?.(reason);
}
