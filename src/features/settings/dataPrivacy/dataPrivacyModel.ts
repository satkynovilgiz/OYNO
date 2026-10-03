import type { PrivateBackend } from '@/services/sync/privateSync/privateSync';
import type { PrivateDomain } from '@/services/sync/privateSync/domains';

/**
 * Data & Privacy Center - pure status rules derived from OYNO's REAL
 * architecture (no toggles for things that don't exist):
 *   - account progress, Journal and Saved: synced by their own server
 *     tables when signed in; on this device for a guest
 *   - private learning data (reading, highlights + notes, collections,
 *     study, listening, weekly goal): Private Cloud Sync - "synced" only
 *     after this account really synced; "not synced" while the account side
 *     isn't deployed or hasn't synced yet
 *   - offline downloads: always this device only
 */

export type DataStatus = 'device' | 'account' | 'not_synced' | 'signed_out_unavailable';
export type DataCategory = 'account_progress' | 'private_learning' | 'journal' | 'saved' | 'offline_downloads' | 'listening' | 'highlights';

export const DATA_CATEGORIES: readonly DataCategory[] = ['account_progress', 'private_learning', 'journal', 'saved', 'offline_downloads', 'listening', 'highlights'];

export type AccountContext = { signedIn: boolean; backend: PrivateBackend; privateSyncedAt: string | null };

export function privateStatus(context: AccountContext): DataStatus {
  if (!context.signedIn) return 'device';
  if (context.backend === 'missing' || !context.privateSyncedAt) return 'not_synced';
  return 'account';
}

export function categoryStatus(category: DataCategory, context: AccountContext): DataStatus {
  switch (category) {
    case 'offline_downloads':
      return 'device';
    case 'account_progress':
    case 'journal':
    case 'saved':
      return context.signedIn ? 'account' : 'device';
    default:
      return privateStatus(context);
  }
}

export type CloudSyncView = 'signed_out_unavailable' | 'synced' | 'syncing' | 'waiting' | 'unavailable' | 'issue' | 'not_synced_yet';

/** The Cloud Sync line. "Last synced" is shown only when it is known. */
export function cloudSyncView(context: AccountContext, state: 'idle' | 'syncing' | 'synced' | 'offline' | 'error'): { view: CloudSyncView; lastSyncedAt: string | null } {
  if (!context.signedIn) return { view: 'signed_out_unavailable', lastSyncedAt: null };
  if (context.backend === 'missing') return { view: 'unavailable', lastSyncedAt: null };
  const view: CloudSyncView = state === 'syncing' ? 'syncing' : state === 'offline' ? 'waiting' : state === 'error' ? 'issue' : context.privateSyncedAt ? 'synced' : 'not_synced_yet';
  return { view, lastSyncedAt: context.privateSyncedAt };
}

/** The synced learning data, as people know it (no internal names). */
export const SYNCED_DOMAIN_LABELS: readonly { key: string; domains: PrivateDomain[] }[] = [
  { key: 'reading', domains: ['reading'] },
  { key: 'highlights', domains: ['highlights'] },
  { key: 'collections', domains: ['collections'] },
  { key: 'challengeReview', domains: ['mistakes'] },
  { key: 'glossaryStudy', domains: ['glossary_study', 'glossary_sessions'] },
  { key: 'gameRecords', domains: ['game_records'] },
  { key: 'komuzFavorites', domains: ['komuz_favorites'] },
  { key: 'learningPaths', domains: ['path_steps'] },
  { key: 'listening', domains: ['listening_history', 'audio_bookmarks'] },
  { key: 'weeklyGoal', domains: ['weekly_goal'] },
];

/**
 * "Reset learning data" removes ONLY these. Highlights/notes, collections,
 * game records, bookmarks, the Journal and account progress are NOT part
 * of it (each has its own management).
 */
export const RESET_DOMAINS: readonly PrivateDomain[] = ['reading', 'mistakes', 'glossary_study', 'glossary_sessions', 'path_steps'];

export type ResetPreview = { readingRecords: number; mistakes: number; studiedTerms: number; studySessions: number; pathSteps: number };

export function resetIsEmpty(preview: ResetPreview): boolean {
  return Object.values(preview).every((value) => value === 0);
}
