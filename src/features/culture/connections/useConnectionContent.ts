import { useCallback, useMemo } from 'react';
import type { ImageSourcePropType } from 'react-native';

import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useCultureMaterials } from '@/services/content/cultureService';
import { isWaitingForNetwork } from '@/services/offline/offlineManifest';

import { cultureCategoryImages, cultureItemImages } from '../data';
import type { CultureCategoryId } from '../types';
import type { ConnectionContentType } from './connectionsData';

export type ConnectionTarget = { type: ConnectionContentType; id: string; title: string; image: ImageSourcePropType | { uri: string } | null };

/**
 * Titles + existing images for connection endpoints, from the SAME
 * content queries the app already uses (localized, offline-aware). The
 * connection metadata itself is bundled; the destination follows the
 * normal offline availability of its content.
 */
export function useConnectionContent() {
  const items = useAllCultureItems();
  const materials = useCultureMaterials();
  const targets = useMemo(() => {
    const map = new Map<string, ConnectionTarget>();
    for (const item of items.data ?? [])
      map.set(`culture_item:${item.id}`, {
        type: 'culture_item',
        id: item.id,
        title: item.title,
        image: item.image_url ? { uri: item.image_url } : (cultureItemImages[item.id]?.[0] ?? cultureCategoryImages[item.category_id as CultureCategoryId] ?? null),
      });
    for (const material of materials.data ?? []) map.set(`culture_material:${material.id}`, { type: 'culture_material', id: material.id, title: material.title, image: material.image_url ? { uri: material.image_url } : null });
    return map;
  }, [items.data, materials.data]);
  const get = useCallback((type: ConnectionContentType, id: string) => targets.get(`${type}:${id}`) ?? null, [targets]);
  const exists = useCallback((type: ConnectionContentType, id: string) => targets.has(`${type}:${id}`), [targets]);
  return { get, exists, isLoading: items.isLoading, waitingForNetwork: isWaitingForNetwork(items), retry: () => void items.refetch() };
}
