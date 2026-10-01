import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ImageSourcePropType } from 'react-native';

import { collections as curatedCollections } from '@/features/collections/collectionsData';
import { mockGamesList } from '@/features/games/mockData';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { trails } from '@/features/trails/trailsData';
import type { SupportedLanguage } from '@/i18n';
import { track } from '@/services/analytics/analytics';
import {
  buildCollectionCatalog,
  buildCultureItemCatalog,
  buildCultureMaterialCatalog,
  buildExploreCatalog,
  buildGameCatalog,
  buildInteractiveExperienceCatalog,
  buildTrailCatalog,
  type CatalogItem,
} from '@/services/content/contentCatalog';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useCultureCategories, useCultureMaterials } from '@/services/content/cultureService';
import { useExploreRegions } from '@/services/content/exploreService';
import { ownerCollections, useMyCollectionsStore } from '@/store/useMyCollectionsStore';

import { collectionEventProps, type CollectionContentType, type CollectionsData, type ResolvedContent } from './myCollectionsModel';

/** The current person's collections (re-selected the moment the account
 * changes - never another account's). */
export function useMyCollections(): { data: CollectionsData; owner: string; isLoaded: boolean } {
  const owner = useRecordsOwner();
  const saved = useMyCollectionsStore((state) => state.saved);
  const isLoaded = useMyCollectionsStore((state) => state.isLoaded);
  useEffect(() => {
    void useMyCollectionsStore.getState().load();
  }, []);
  return { data: ownerCollections(saved, owner), owner, isLoaded };
}

/** Store actions bound to the current owner, with structural-only analytics
 * (content type - never a collection's name or description). */
export function useCollectionActions(owner: string) {
  return useMemo(() => {
    const store = () => useMyCollectionsStore.getState();
    return {
      create: (input: { name: string; description?: string | null }) => {
        const collection = store().create(owner, input);
        track('collection_created');
        return collection;
      },
      edit: (id: string, input: { name: string; description: string | null }) => store().edit(owner, id, input),
      remove: (id: string) => store().remove(owner, id),
      add: (collectionId: string, contentType: CollectionContentType, contentId: string) => {
        store().add(owner, collectionId, contentType, contentId);
        track('collection_item_added', collectionEventProps(contentType));
      },
      removeItem: (collectionId: string, contentType: CollectionContentType, contentId: string) => {
        store().removeItem(owner, collectionId, contentType, contentId);
        track('collection_item_removed', collectionEventProps(contentType));
      },
      move: (collectionId: string, index: number, delta: -1 | 1) => store().move(owner, collectionId, index, delta),
    };
  }, [owner]);
}

/** Resolves a stored reference against the live content catalog (titles,
 * images and routes are never copied into a collection). */
export function useContentResolver(): { resolve: (contentType: string, contentId: string) => ResolvedContent | null; ready: boolean } {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const { data: categories, isLoading: l1 } = useCultureCategories();
  const { data: materials, isLoading: l2 } = useCultureMaterials();
  const { data: items, isLoading: l3 } = useAllCultureItems();
  const { data: regions, isLoading: l4 } = useExploreRegions();

  const byKey = useMemo(() => {
    const catalog: CatalogItem[] = [
      ...buildExploreCatalog(regions ?? [], language),
      ...buildCultureItemCatalog(items ?? [], categories ?? [], language),
      ...buildInteractiveExperienceCatalog(t),
      ...buildCultureMaterialCatalog(materials ?? []),
      ...buildGameCatalog(mockGamesList, t),
      ...buildTrailCatalog(trails, language, () => null),
      ...buildCollectionCatalog(curatedCollections, language, null),
    ];
    return new Map(catalog.map((entry) => [`${entry.contentType}:${entry.id}`, entry]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, materials, items, regions, language]);

  return {
    ready: !(l1 || l2 || l3 || l4),
    resolve: (contentType, contentId) => {
      const entry = byKey.get(`${contentType}:${contentId}`);
      return entry ? { title: entry.title, route: entry.route, thumbnail: entry.thumbnail as ImageSourcePropType | null } : null;
    },
  };
}
