import type { QueryClient } from '@tanstack/react-query';

import type { HealthReport } from './offlineHealth';
import type { OfflineManifestEntry } from './offlineManifest';

/**
 * Is this download USABLE offline right now - not merely listed? It must
 * have stored results, must not have failed the last "Check downloads"
 * (incomplete), and every result it needs must actually be in the query
 * cache the screens read (downloads are re-seeded there at startup). A
 * background refresh in progress doesn't matter: the existing copy stays.
 */
export function isDownloadUsable(entry: OfflineManifestEntry | undefined, health: HealthReport | null, hasCachedResult: (queryHash: string) => boolean): boolean {
  if (!entry || entry.queryHashes.length === 0) return false;
  if (health?.items[entry.id] === 'incomplete') return false;
  return entry.queryHashes.every(hasCachedResult);
}

/** `hasCachedResult` for `isDownloadUsable`, from a live query client. */
export function cachedResultChecker(queryClient: QueryClient): (queryHash: string) => boolean {
  const cache = queryClient.getQueryCache();
  return (hash) => cache.get(hash)?.state.data !== undefined;
}

/**
 * Can this route's EXISTING screen open with data already on the device?
 * Reads the react-query cache - which offline downloads re-seed at startup
 * (offlineCache.hydrateQueryClient) and normal browsing fills - so it
 * reuses the offline system rather than keeping a second list. Screens
 * that are fully local (games, interactive experiences, trails, Journey,
 * the map, Daily once its item is loaded) are always available.
 */
export function isRouteAvailableOffline(route: string, queryClient: QueryClient): boolean {
  const has = (key: unknown[]) => queryClient.getQueryData(key) !== undefined;
  const [, section, id, sub] = route.split('?')[0].split('/');
  if (section === 'explore') {
    if (!id || id === 'map' || id === 'search') return has(['explore_regions']);
    return has(['explore_regions']) && has(['discoveries']);
  }
  if (section === 'culture' && id === 'item' && sub) return has(['culture_item', sub]);
  if (section === 'culture' && id === 'material' && sub) return has(['culture_material', sub]);
  // Glossary terms are read from the culture list (useGlossary).
  if (section === 'culture' && id === 'glossary' && sub && sub !== 'study') return has(['culture_items', 'all']);
  if (section === 'collections') return has(['culture_items', 'all']) && has(['culture_materials']);
  return true;
}
