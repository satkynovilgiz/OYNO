import { useMemo } from 'react';

import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { isWaitingForNetwork } from '@/services/offline/offlineManifest';

import { resolveGlossary, type ResolvedGlossaryEntry } from './glossaryModel';

/** The glossary joined with the live, localized culture items. */
export function useGlossary(): { entries: ResolvedGlossaryEntry[]; isLoading: boolean; waitingForNetwork: boolean; retry: () => void } {
  const query = useAllCultureItems();
  const entries = useMemo(() => resolveGlossary(query.data), [query.data]);
  return { entries, isLoading: query.isLoading, waitingForNetwork: isWaitingForNetwork(query), retry: () => void query.refetch() };
}
