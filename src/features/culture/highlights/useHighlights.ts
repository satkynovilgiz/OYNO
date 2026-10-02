import { useEffect, useMemo } from 'react';

import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { track } from '@/services/analytics/analytics';
import { ownerHighlights, useHighlightsStore } from '@/store/useHighlightsStore';

import { highlightEventProps, type HighlightContentType, type HighlightsData } from './highlightsModel';

/** The current person's highlights (re-selected on account change). */
export function useHighlights(): { data: HighlightsData; owner: string; isLoaded: boolean } {
  const owner = useRecordsOwner();
  const saved = useHighlightsStore((state) => state.saved);
  const isLoaded = useHighlightsStore((state) => state.isLoaded);
  useEffect(() => {
    void useHighlightsStore.getState().load();
  }, []);
  return { data: ownerHighlights(saved, owner), owner, isLoaded };
}

/** Actions for the current owner; analytics carry ids/section only. */
export function useHighlightActions(owner: string) {
  return useMemo(
    () => ({
      save: (input: { contentType: HighlightContentType; contentId: string; sectionKey: string; language: string; title: string; text: string }) => {
        const result = useHighlightsStore.getState().save(owner, input);
        if (result.created) track('highlight_saved', highlightEventProps(result.highlight));
        return result.highlight;
      },
      setNote: (id: string, note: string) => useHighlightsStore.getState().setNote(owner, id, note),
      remove: (id: string) => {
        const highlight = ownerHighlights(useHighlightsStore.getState().saved, owner)[id];
        useHighlightsStore.getState().remove(owner, id);
        if (highlight) track('highlight_removed', highlightEventProps(highlight));
      },
    }),
    [owner],
  );
}
