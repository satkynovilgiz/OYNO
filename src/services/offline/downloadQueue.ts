import type { OfflineKind } from './offlineManifest';

/**
 * Offline Download Queue - pure rules, on top of the EXISTING offline
 * manifest (not a second cache). The queue only holds INTENT: which public
 * content download is wanted, by whom (requesters: 'user', 'region:<id>',
 * 'path:<id>'), and how urgently. The data itself is still written by the
 * existing download and recorded in the manifest.
 *
 *   one intent per download id   two packs asking for the same article
 *                                share ONE intent (requesters merged), so
 *                                it never downloads twice
 *   FIFO, user first             an explicit user download outranks
 *                                background refreshes/retries; otherwise
 *                                first come, first served
 *   network gate                 "Wi-Fi only" waits on cellular instead of
 *                                failing; no connection waits too
 *
 * Persisted: ids, kinds, public content ids, requester tags, priority,
 * timestamps, attempt counts. Never promises, never private data.
 */

export type QueuePriority = 'user' | 'background';
export type QueueIntentStatus = 'queued' | 'downloading' | 'failed';

export type QueueIntent = {
  id: string;
  kind: OfflineKind;
  contentId: string;
  /** Owners waiting for this download (merged, de-duplicated, ordered). */
  requesters: string[];
  priority: QueuePriority;
  enqueuedAt: string;
  status: QueueIntentStatus;
  attempts: number;
};

export type DownloadQueue = { intents: QueueIntent[] };

export const EMPTY_QUEUE: DownloadQueue = { intents: [] };

/** Downloads waiting in the queue at most (a guard, far above real use). */
export const MAX_QUEUE = 500;

export function enqueue(queue: DownloadQueue, request: { id: string; kind: OfflineKind; contentId: string; requester: string; priority: QueuePriority }, now = new Date()): DownloadQueue {
  const existing = queue.intents.find((intent) => intent.id === request.id);
  if (existing) {
    const requesters = existing.requesters.includes(request.requester) ? existing.requesters : [...existing.requesters, request.requester];
    const priority: QueuePriority = existing.priority === 'user' || request.priority === 'user' ? 'user' : 'background';
    // A failed item asked for again goes back in line (Retry) - same intent, no duplicate.
    const status: QueueIntentStatus = existing.status === 'failed' ? 'queued' : existing.status;
    if (requesters === existing.requesters && priority === existing.priority && status === existing.status) return queue;
    return { intents: queue.intents.map((intent) => (intent.id === request.id ? { ...intent, requesters, priority, status } : intent)) };
  }
  if (queue.intents.length >= MAX_QUEUE) return queue;
  return {
    intents: [
      ...queue.intents,
      { id: request.id, kind: request.kind, contentId: request.contentId, requesters: [request.requester], priority: request.priority, enqueuedAt: now.toISOString(), status: 'queued', attempts: 0 },
    ],
  };
}

/**
 * Cancel one owner's request. Other owners keep the intent (a shared
 * article another pack still needs keeps downloading). The last owner
 * cancelling removes the intent. Returns whether the intent is gone.
 */
export function cancelRequest(queue: DownloadQueue, id: string, requester: string): { queue: DownloadQueue; removed: boolean } {
  const intent = queue.intents.find((candidate) => candidate.id === id);
  if (!intent || !intent.requesters.includes(requester)) return { queue, removed: false };
  const requesters = intent.requesters.filter((value) => value !== requester);
  if (requesters.length === 0) return { queue: { intents: queue.intents.filter((candidate) => candidate.id !== id) }, removed: true };
  return { queue: { intents: queue.intents.map((candidate) => (candidate.id === id ? { ...candidate, requesters } : candidate)) }, removed: false };
}

export function removeIntent(queue: DownloadQueue, id: string): DownloadQueue {
  return queue.intents.some((intent) => intent.id === id) ? { intents: queue.intents.filter((intent) => intent.id !== id) } : queue;
}

export function setStatus(queue: DownloadQueue, id: string, status: QueueIntentStatus, countAttempt = false): DownloadQueue {
  return { intents: queue.intents.map((intent) => (intent.id === id ? { ...intent, status, attempts: intent.attempts + (countAttempt ? 1 : 0) } : intent)) };
}

/** The next intent to run: user priority first, then FIFO. Null while one is already running. */
export function nextIntent(queue: DownloadQueue): QueueIntent | null {
  if (queue.intents.some((intent) => intent.status === 'downloading')) return null;
  const waiting = queue.intents.filter((intent) => intent.status === 'queued');
  return waiting.find((intent) => intent.priority === 'user') ?? waiting[0] ?? null;
}

// ---------------------------------------------------------------------
// Network policy
// ---------------------------------------------------------------------
export type DownloadPreference = 'any' | 'wifi_only';
/** Today's behaviour: downloads run on any connection. */
export const DEFAULT_DOWNLOAD_PREFERENCE: DownloadPreference = 'any';

/** expo-network state, as reported (type is a NetworkStateType string). */
export type NetworkSnapshot = { isConnected: boolean | undefined; type: string | undefined };

/**
 * Wi-Fi vs cellular is only reported on iOS and Android (expo-network:
 * WIFI / CELLULAR / ETHERNET). On web the type is always UNKNOWN, so the
 * "Wi-Fi only" choice is not offered there - it would be a guess.
 */
export function wifiOnlySupported(platform: string): boolean {
  return platform === 'ios' || platform === 'android';
}

/** Unmetered types we can positively identify. Anything else (VPN, OTHER, UNKNOWN) is not assumed to be Wi-Fi. */
const UNMETERED = new Set(['WIFI', 'ETHERNET']);

export type NetworkGate = 'go' | 'waiting_connection' | 'waiting_wifi';

export function networkGate(preference: DownloadPreference, network: NetworkSnapshot, supported: boolean): NetworkGate {
  if (network.isConnected === false) return 'waiting_connection';
  if (preference === 'wifi_only' && supported) return network.type && UNMETERED.has(network.type) ? 'go' : 'waiting_wifi';
  // Unknown connectivity at boot counts as online (same rule as networkStatus.ts).
  return 'go';
}

export function effectivePreference(preference: DownloadPreference, supported: boolean): DownloadPreference {
  return supported ? preference : 'any';
}

// ---------------------------------------------------------------------
// What screens show
// ---------------------------------------------------------------------
export type QueueRowStatus = 'downloading' | 'queued' | 'waiting_wifi' | 'waiting_connection' | 'failed';

export function rowStatus(intent: QueueIntent, gate: NetworkGate): QueueRowStatus {
  if (intent.status === 'downloading') return 'downloading';
  if (intent.status === 'failed') return 'failed';
  return gate === 'go' ? 'queued' : gate;
}

export type QueueSummary = Record<QueueRowStatus, QueueIntent[]>;

export function summarizeQueue(queue: DownloadQueue, gate: NetworkGate): QueueSummary {
  const summary: QueueSummary = { downloading: [], queued: [], waiting_wifi: [], waiting_connection: [], failed: [] };
  for (const intent of queue.intents) summary[rowStatus(intent, gate)].push(intent);
  return summary;
}

/**
 * Real progress only. Downloads are fetched as whole query results (no
 * byte stream), so progress is "done of total" items - never a guessed
 * percentage.
 */
export function itemProgress(itemIds: readonly string[], isDone: (id: string) => boolean): { done: number; total: number } {
  return { done: itemIds.filter(isDone).length, total: itemIds.length };
}

// ---------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------
const KINDS: readonly OfflineKind[] = ['nature', 'collection', 'culture_item', 'culture_index'];
const REQUESTER = /^(user|(region|path):[a-z0-9-]{1,80})$/;

/**
 * Restore after a restart. An item that was downloading when the app
 * stopped goes back to `queued` (its promise/task is gone; it simply runs
 * again). Anything malformed is dropped, never fatal.
 */
export function parseQueue(raw: unknown): DownloadQueue {
  const intents = raw && typeof raw === 'object' && Array.isArray((raw as { intents?: unknown }).intents) ? (raw as { intents: unknown[] }).intents : [];
  const seen = new Set<string>();
  const valid: QueueIntent[] = [];
  for (const value of intents) {
    if (!value || typeof value !== 'object') continue;
    const intent = value as Partial<QueueIntent>;
    if (typeof intent.kind !== 'string' || !KINDS.includes(intent.kind as OfflineKind) || typeof intent.contentId !== 'string' || intent.contentId.length > 120) continue;
    const id = `${intent.kind}:${intent.contentId}`;
    if (intent.id !== id || seen.has(id)) continue;
    const requesters = Array.isArray(intent.requesters) ? intent.requesters.filter((requester): requester is string => typeof requester === 'string' && REQUESTER.test(requester)) : [];
    if (requesters.length === 0) continue;
    seen.add(id);
    valid.push({
      id,
      kind: intent.kind as OfflineKind,
      contentId: intent.contentId,
      requesters: [...new Set(requesters)],
      priority: intent.priority === 'user' ? 'user' : 'background',
      enqueuedAt: typeof intent.enqueuedAt === 'string' ? intent.enqueuedAt : new Date(0).toISOString(),
      status: intent.status === 'failed' ? 'failed' : 'queued',
      attempts: typeof intent.attempts === 'number' && intent.attempts >= 0 ? Math.floor(intent.attempts) : 0,
    });
  }
  return { intents: valid.slice(0, MAX_QUEUE) };
}

export function parsePreference(raw: unknown): DownloadPreference {
  return raw === 'wifi_only' ? 'wifi_only' : DEFAULT_DOWNLOAD_PREFERENCE;
}
