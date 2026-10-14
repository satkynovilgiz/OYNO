import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';

import { cultureItemImages, cultureMaterialImages } from '@/features/culture/data';
import { continueReading, type ReadingProgress } from '@/features/culture/reading/readingModel';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { listRecovery } from '@/features/recovery/recoveryModel';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useCultureMaterials } from '@/services/content/cultureService';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { isRouteAvailableOffline } from '@/services/offline/offlineAvailability';
import { recordFor, useFirstUseStore } from '@/store/useFirstUseStore';
import { useJournalDraftStore } from '@/store/useJournalDraftStore';
import { ownerReading, useReadingStore } from '@/store/useReadingStore';

import type { HomeRecommendation } from '../homeRecommendation';
import { homeAudience, pickContinue, type ContinuePick, type HomeAudience } from './homePrimaryModel';

export type ReadingDisplay = { title: string; image: ImageSourcePropType | null };

export type HomeContinue = {
  /** 'checking' while the local stores Continue reads are still loading - never a blank slot. */
  status: 'checking' | 'ready';
  pick: ContinuePick | null;
  audience: HomeAudience;
  reading: ReadingDisplay | null;
};

/**
 * Gathers the CURRENT owner's real unfinished work for pickContinue (the
 * Recovery Center's own listing, the first-use record, Continue Reading,
 * Home's recommendation). Drafts live in memory maps, so they are re-read
 * whenever Home is shown again.
 */
export function useHomeContinue(input: { recommendation: HomeRecommendation; hasRecent: boolean; hasPlayed: boolean }): HomeContinue {
  const owner = useRecordsOwner();
  const queryClient = useQueryClient();
  const { isOffline } = useNetworkStatus();
  const [version, setVersion] = useState(0);
  useFocusEffect(useCallback(() => setVersion((value) => value + 1), []));
  useEffect(() => {
    void useReadingStore.getState().load();
    void useFirstUseStore.getState().load();
    void useJournalDraftStore.getState().load();
  }, []);

  const readingLoaded = useReadingStore((state) => state.isLoaded);
  const readingSaved = useReadingStore((state) => state.saved);
  const firstUseStatus = useFirstUseStore((state) => state.status);
  const firstUseSaved = useFirstUseStore((state) => state.saved);
  const draftsLoaded = useJournalDraftStore((state) => state.isLoaded);
  const draftsSaved = useJournalDraftStore((state) => state.saved);
  const { data: items } = useAllCultureItems();
  const { data: materials } = useCultureMaterials();

  return useMemo(() => {
    const data = ownerReading(readingSaved, owner);
    const resolve = (record: ReadingProgress) => {
      if (record.contentType === 'culture_item') {
        const item = items?.find((row) => row.id === record.contentId);
        return item ? { route: `/culture/item/${item.id}`, title: item.title, image: item.image_url ? { uri: item.image_url } : (cultureItemImages[item.id]?.[0] ?? null) } : null;
      }
      const material = materials?.find((row) => row.id === record.contentId);
      return material ? { route: `/culture/material/${material.id}`, title: material.title, image: cultureMaterialImages[material.id] ?? null } : null;
    };
    const current = continueReading(data, (record) => resolve(record) !== null);
    const resolved = current ? resolve(current) : null;
    const unknown = () => undefined;
    const unsaved = listRecovery({
      owner,
      portfolioExists: unknown,
      scrapbookExists: unknown,
      question: unknown,
      comparison: unknown,
      journalDrafts: draftsLoaded ? Object.values(draftsSaved[owner] ?? {}) : [],
      journalEntryExists: unknown,
      firstUse: null,
    });
    // A failed first-use load just means no guide card - it never blocks Home.
    const guide = firstUseStatus === 'ready' ? recordFor(firstUseSaved, owner) : null;
    const pick = pickContinue({
      unsaved,
      guideActive: guide?.status === 'active',
      reading: current && resolved ? { record: current, route: resolved.route } : null,
      recommendation: input.recommendation,
      isAvailable: (route) => !isOffline || isRouteAvailableOffline(route, queryClient),
    });
    const audience = homeAudience({
      pick,
      hasReading: Object.keys(data).length > 0,
      hasRecent: input.hasRecent,
      hasPlayed: input.hasPlayed,
      guideStarted: guide?.status === 'active' || guide?.status === 'finished',
    });
    const checking = !readingLoaded || !draftsLoaded || firstUseStatus === 'idle' || firstUseStatus === 'loading';
    return { status: checking && !pick ? 'checking' : 'ready', pick, audience, reading: resolved && pick?.kind === 'reading' ? { title: resolved.title, image: resolved.image } : null };
    // `version` re-reads the in-memory draft maps when Home is focused again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, readingSaved, readingLoaded, firstUseStatus, firstUseSaved, draftsLoaded, draftsSaved, items, materials, input.recommendation, input.hasRecent, input.hasPlayed, isOffline, version]);
}
