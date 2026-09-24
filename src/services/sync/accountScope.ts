import AsyncStorage from '@react-native-async-storage/async-storage';

import { safeJsonParse } from '@/services/storage/safeJson';

import { PENDING_FAVORITES_KEY, PENDING_VISITS_KEY } from './outbox';

/**
 * Which account the device's account-bound local state belongs to:
 * a user id, or 'guest'. Missing = written before sync existed.
 */
export const ACCOUNT_OWNER_KEY = 'oyno.account.owner';
const STASH_PREFIX = 'oyno.account.stash:';

/**
 * Local keys that hold one person's account state. They are cleared on
 * sign-out so the next person on the device never sees them. Everything
 * else stays: downloaded offline content, cached images, reminder
 * settings and their scheduled notification ids, language, onboarding
 * and age-mode flags - device state, not account state.
 */
export const ACCOUNT_BOUND_KEYS = [
  'oyno.progress.cache',
  'oyno.favorites.cache',
  'oyno.avatar.cache',
  'oyno.daily.completions',
  'oyno.challenges.v1',
  'oyno.wallpapers.favorites',
  PENDING_VISITS_KEY,
  PENDING_FAVORITES_KEY,
];

let extraAccountKeys: string[] = [];

/** Lets a feature (e.g. the private Journal) register its own account-bound keys. */
export function registerAccountBoundKeys(keys: string[]): void {
  extraAccountKeys = Array.from(new Set([...extraAccountKeys, ...keys]));
}

/** Receives the owner being cleared ('guest' or a user id). */
type ClearHandler = (owner: string) => void;
const clearHandlers = new Set<ClearHandler>();

/** Extra clean-up when an account's local state is cleared (files, not keys). */
export function registerAccountClearHandler(handler: ClearHandler): void {
  clearHandlers.add(handler);
}

export function accountBoundKeys(): string[] {
  return [...ACCOUNT_BOUND_KEYS, ...extraAccountKeys];
}

export async function readAccountOwner(): Promise<string | null> {
  return AsyncStorage.getItem(ACCOUNT_OWNER_KEY).catch(() => null);
}

export async function writeAccountOwner(owner: string): Promise<void> {
  await AsyncStorage.setItem(ACCOUNT_OWNER_KEY, owner).catch(() => {});
}

/** Removes every account-bound key from the live (visible) state. */
/**
 * Clears the live account-bound keys. Files are per owner: only `filesOwner`'s
 * files are removed (never another account's - e.g. a signed-out account's
 * stashed offline photos). Omit it to keep every file.
 */
export async function clearAccountBoundState(options: { filesOwner?: string | null } = {}): Promise<void> {
  await AsyncStorage.multiRemove(accountBoundKeys()).catch(() => {});
  if (!options.filesOwner) return;
  for (const handler of clearHandlers) {
    try {
      handler(options.filesOwner);
    } catch {
      // Best effort - never blocks a sign-out.
    }
  }
}

/**
 * Keeps a signed-out account's not-yet-synced state aside, readable only
 * when that same account signs in again on this device - never shown to
 * a guest or to another account. Used only when the final sync before
 * sign-out didn't finish (offline), so offline progress is never lost.
 */
export async function stashAccountState(userId: string): Promise<void> {
  const pairs = await AsyncStorage.multiGet(accountBoundKeys()).catch(() => [] as readonly [string, string | null][]);
  const stash: Record<string, string> = {};
  for (const [key, value] of pairs) if (value !== null) stash[key] = value;
  if (Object.keys(stash).length === 0) return;
  await AsyncStorage.setItem(`${STASH_PREFIX}${userId}`, JSON.stringify(stash)).catch(() => {});
}

/** Returns and removes an account's stash (key -> raw stored value). */
export async function takeAccountStash(userId: string): Promise<Record<string, string> | null> {
  const key = `${STASH_PREFIX}${userId}`;
  const raw = await AsyncStorage.getItem(key).catch(() => null);
  if (!raw) return null;
  await AsyncStorage.removeItem(key).catch(() => {});
  const parsed = safeJsonParse<unknown>(raw, null);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, string>) : null;
}

export async function hasAccountStash(userId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(`${STASH_PREFIX}${userId}`).catch(() => null)) !== null;
}

export async function discardAccountStash(userId: string): Promise<void> {
  await AsyncStorage.removeItem(`${STASH_PREFIX}${userId}`).catch(() => {});
}
