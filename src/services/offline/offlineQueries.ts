import type { QueryKey } from '@tanstack/react-query';

import type { Collection } from '@/features/collections/collectionsData';
import { fetchAllCultureItems, fetchCultureItem } from '@/services/content/cultureItemsService';
import { fetchCultureMaterial, fetchCultureMaterials } from '@/services/content/cultureService';
import { fetchDiscoveries } from '@/services/content/discoveriesService';
import { fetchCurrentQuest, fetchExploreRegions } from '@/services/content/exploreService';
import { fetchQuestSteps } from '@/services/content/questStepsService';
import { fetchContentTranslationsForOffline } from '@/services/content/translationsService';

import type { OfflineKind } from './offlineManifest';

/**
 * Which existing query results each downloadable screen reads - mirrors the
 * hooks those screens already call (same keys, same fetchers), so the
 * offline copy is exactly what the screen would have fetched.
 */
export function queryKeysForDownload(kind: OfflineKind, contentId: string, context: { collection?: Collection; questId?: string | null }): QueryKey[] {
  // Every download also keeps the RU/EN translations, so a downloaded
  // article or destination reads in the app language offline too.
  return [...contentKeysForDownload(kind, contentId, context), ['content_translations']];
}

function contentKeysForDownload(kind: OfflineKind, contentId: string, context: { collection?: Collection; questId?: string | null }): QueryKey[] {
  if (kind === 'nature') {
    // app/explore/[id].tsx: useExploreRegions, useDiscoveries, useCurrentQuest, useQuestSteps
    const keys: QueryKey[] = [['explore_regions'], ['discoveries'], ['quests', 'current']];
    if (context.questId) keys.push(['quest_steps', context.questId]);
    return keys;
  }
  if (kind === 'culture_item') {
    // app/culture/item/[itemId].tsx: useCultureItem
    return [['culture_item', contentId]];
  }
  // CollectionDetailScreen: useAllCultureItems + useCultureMaterials, plus
  // each referenced item/material's own detail query so tapping through
  // works offline too.
  const keys: QueryKey[] = [['culture_items', 'all'], ['culture_materials']];
  for (const ref of context.collection?.sections ?? []) {
    if (ref.kind === 'culture_item') keys.push(['culture_item', ref.id]);
    if (ref.kind === 'culture_material') keys.push(['culture_material', ref.id]);
  }
  return keys;
}

/** The existing fetcher for a supported query key. */
export function fetcherFor(key: QueryKey): (() => Promise<unknown>) | null {
  const [root, arg] = key as [string, string | undefined];
  switch (root) {
    case 'explore_regions':
      return arg === undefined ? fetchExploreRegions : null;
    case 'discoveries':
      return fetchDiscoveries;
    case 'quests':
      return arg === 'current' ? fetchCurrentQuest : null;
    case 'quest_steps':
      return arg ? () => fetchQuestSteps(arg) : null;
    case 'culture_items':
      return arg === 'all' ? fetchAllCultureItems : null;
    case 'culture_item':
      return arg ? () => fetchCultureItem(arg) : null;
    case 'culture_materials':
      return fetchCultureMaterials;
    case 'culture_material':
      return arg ? () => fetchCultureMaterial(arg) : null;
    case 'content_translations':
      return fetchContentTranslationsForOffline;
    default:
      return null;
  }
}
