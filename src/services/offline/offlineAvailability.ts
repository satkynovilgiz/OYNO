import type { QueryClient } from '@tanstack/react-query';

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
  if (section === 'collections') return has(['culture_items', 'all']) && has(['culture_materials']);
  return true;
}
