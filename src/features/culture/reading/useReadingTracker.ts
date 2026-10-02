import { useCallback, useEffect, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native';

import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { track } from '@/services/analytics/analytics';
import { ownerReading, useReadingStore } from '@/store/useReadingStore';

import { MIN_MEANINGFUL_PROGRESS, readingKey, resumeOffset, scrollRatio, shouldOfferResume, type ReadingContentType, type ReadingProgress } from './readingModel';

const RECORD_INTERVAL_MS = 300;

export type ReadingTracker = {
  scrollRef: React.RefObject<ScrollView | null>;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onContentSizeChange: (width: number, height: number) => void;
  onLayout: (event: { nativeEvent: { layout: { height: number } } }) => void;
  /** Live position 0..1 (null when the article can't scroll). */
  ratio: number | null;
  record: ReadingProgress | undefined;
  promptVisible: boolean;
  resume: () => void;
  startFromTop: () => void;
  markRead: () => void;
  startOver: () => void;
  /** Layout is about to change (text size, spacing, focus mode): keep the
   * same RATIO once the new layout is measured - never jump to the top. */
  keepPosition: () => void;
};

/**
 * Measures real reading on an article's existing ScrollView. Progress is
 * scroll position / scrollable range (no timers, opening != reading).
 * Resume is OFFERED, never automatic, and maps the saved RATIO onto the
 * current layout (so a language change can't send the reader to a stale
 * pixel offset). Analytics: event + content type/id only.
 */
export function useReadingTracker(contentType: ReadingContentType, contentId: string): ReadingTracker {
  const owner = useRecordsOwner();
  const record = useReadingStore((state) => ownerReading(state.saved, owner)[readingKey(contentType, contentId)]);
  const isLoaded = useReadingStore((state) => state.isLoaded);
  const scrollRef = useRef<ScrollView | null>(null);
  const contentHeight = useRef(0);
  const viewportHeight = useRef(0);
  const pendingResume = useRef<number | null>(null);
  const lastRecordAt = useRef(0);
  const decided = useRef(false);
  const [promptVisible, setPromptVisible] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);
  const lastRatio = useRef<number | null>(null);

  useEffect(() => {
    void useReadingStore.getState().load();
    track('reading_opened', { content_type: contentType, content_id: contentId });
  }, [contentType, contentId]);

  // Offer resume once, as the article opens (only for unfinished reading).
  useEffect(() => {
    if (!isLoaded || decided.current) return;
    decided.current = true;
    setPromptVisible(shouldOfferResume(record));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  const tryApplyResume = useCallback(() => {
    if (pendingResume.current === null) return;
    const offset = resumeOffset(pendingResume.current, contentHeight.current, viewportHeight.current);
    if (offset === null) return;
    pendingResume.current = null;
    // The scroll this causes is recorded straight away (not throttled away).
    lastRecordAt.current = 0;
    // Not animated: an animation would report (and record) every in-between
    // position, and the throttle could drop the final one.
    scrollRef.current?.scrollTo({ y: offset, animated: false });
  }, []);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      contentHeight.current = contentSize.height;
      viewportHeight.current = layoutMeasurement.height;
      const next = scrollRatio(contentOffset.y, contentSize.height, layoutMeasurement.height);
      setRatio(next);
      lastRatio.current = next;
      if (next === null) return;
      // Mid-relayout (text size change / resume pending): the offset still
      // belongs to the old layout - never record it.
      if (pendingResume.current !== null) return;
      // While the resume question is open, the top-of-page position must not
      // overwrite the saved place; scrolling on past it is an answer.
      if (promptVisible) {
        if (next < MIN_MEANINGFUL_PROGRESS) return;
        setPromptVisible(false);
      }
      const now = Date.now();
      if (now - lastRecordAt.current < RECORD_INTERVAL_MS && next < 0.999) return;
      lastRecordAt.current = now;
      useReadingStore.getState().record(owner, contentType, contentId, next);
    },
    [owner, contentType, contentId, promptVisible],
  );

  return {
    scrollRef,
    onScroll,
    onContentSizeChange: (_width, height) => {
      contentHeight.current = height;
      tryApplyResume();
    },
    onLayout: (event) => {
      viewportHeight.current = event.nativeEvent.layout.height;
      tryApplyResume();
    },
    ratio,
    record,
    promptVisible,
    resume: () => {
      setPromptVisible(false);
      if (!record) return;
      pendingResume.current = record.progress;
      track('reading_resumed', { content_type: contentType, content_id: contentId });
      tryApplyResume();
    },
    startFromTop: () => {
      setPromptVisible(false);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    },
    markRead: () => useReadingStore.getState().markRead(owner, contentType, contentId),
    keepPosition: () => {
      // Applied on the next content-size change (the new layout).
      if (lastRatio.current !== null && lastRatio.current > 0) pendingResume.current = lastRatio.current;
    },
    startOver: () => {
      useReadingStore.getState().reset(owner, contentType, contentId);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    },
  };
}
