import { downloadId, type OfflineKind, type OfflineManifest } from './offlineManifest';

/**
 * The Offline manager as data - derived only from the real store state
 * (manifest + in-flight + failed + ids being removed). An item is
 * "available" only when the manifest has its complete entry; a download
 * that is running or failed never counts as available.
 */
export type OfflineRowState = 'available' | 'downloading' | 'failed' | 'removing';

export type OfflineRow = {
  id: string;
  kind: OfflineKind;
  contentId: string;
  state: OfflineRowState;
  /** Real save time from the manifest; null while downloading/failed. */
  downloadedAt: string | null;
  route: string;
};

export type OfflineGroupId = 'places' | 'collections' | 'culture';

const GROUP_BY_KIND: Record<OfflineKind, OfflineGroupId> = { nature: 'places', collection: 'collections', culture_item: 'culture' };
const GROUP_ORDER: OfflineGroupId[] = ['places', 'collections', 'culture'];

export function offlineRoute(kind: OfflineKind, contentId: string): string {
  if (kind === 'nature') return `/explore/${contentId}`;
  if (kind === 'collection') return `/collections/${contentId}`;
  return `/culture/item/${contentId}`;
}

function parseId(id: string): { kind: OfflineKind; contentId: string } | null {
  const index = id.indexOf(':');
  if (index <= 0) return null;
  const kind = id.slice(0, index) as OfflineKind;
  if (!(kind in GROUP_BY_KIND)) return null;
  return { kind, contentId: id.slice(index + 1) };
}

export type OfflineView = {
  /** Running now (only ids without a finished copy - a background refresh
   * of an existing download stays in its group as available). */
  downloading: OfflineRow[];
  /** Failed and no usable copy exists. */
  needsAttention: OfflineRow[];
  /** Complete downloads, grouped by type, newest first. */
  groups: { id: OfflineGroupId; rows: OfflineRow[] }[];
  availableCount: number;
};

export function buildOfflineView(manifest: OfflineManifest, inFlight: string[], failed: string[], removing: string[] = []): OfflineView {
  const downloading: OfflineRow[] = [];
  const needsAttention: OfflineRow[] = [];
  for (const id of inFlight) {
    if (manifest.entries[id]) continue;
    const parsed = parseId(id);
    if (parsed) downloading.push({ id, ...parsed, state: 'downloading', downloadedAt: null, route: offlineRoute(parsed.kind, parsed.contentId) });
  }
  for (const id of failed) {
    if (manifest.entries[id] || inFlight.includes(id)) continue;
    const parsed = parseId(id);
    if (parsed) needsAttention.push({ id, ...parsed, state: 'failed', downloadedAt: null, route: offlineRoute(parsed.kind, parsed.contentId) });
  }
  const available: OfflineRow[] = Object.values(manifest.entries)
    .map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      contentId: entry.contentId,
      state: removing.includes(entry.id) ? ('removing' as const) : ('available' as const),
      downloadedAt: entry.downloadedAt ?? null,
      route: offlineRoute(entry.kind, entry.contentId),
    }))
    // Newest first; stable tie-break by id so order never jumps.
    .sort((a, b) => (b.downloadedAt ?? '').localeCompare(a.downloadedAt ?? '') || a.id.localeCompare(b.id));
  const groups = GROUP_ORDER.map((id) => ({ id, rows: available.filter((row) => GROUP_BY_KIND[row.kind] === id) })).filter((group) => group.rows.length > 0);
  return { downloading, needsAttention, groups, availableCount: available.filter((row) => row.state === 'available').length };
}

/** "Available offline" is the one phrase for a complete download. */
export function isAvailableOffline(manifest: OfflineManifest, kind: OfflineKind, contentId: string): boolean {
  return !!manifest.entries[downloadId(kind, contentId)];
}

/** Human size of what was really measured; null stays null (never guessed). */
export function formatBytes(bytes: number | null, units: { b: string; kb: string; mb: string } = { b: 'B', kb: 'KB', mb: 'MB' }): string | null {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} ${units.b}`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} ${units.kb}`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ${units.mb}`;
}
