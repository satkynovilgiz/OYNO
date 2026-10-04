import { useMemo } from 'react';

import { LEARNING_PATHS, pathProgress } from '@/features/learn/learningPaths';
import { usePathSignals } from '@/features/learn/usePathSignals';
import { ownerMistakes, useChallengeMistakesStore } from '@/store/useChallengeMistakesStore';
import { ownerStudy, useGlossaryStudyStore } from '@/store/useGlossaryStudyStore';
import { ownerReading, useReadingStore } from '@/store/useReadingStore';

import type { CompletionSignals } from './focusSession';

/** The current owner's EXISTING records, as the session reads them (read-only). */
export function useCompletionSignals(): { signals: CompletionSignals; readingFurthest: Record<string, number> } {
  const { signals: pathSignals, owner } = usePathSignals();
  const mistakes = ownerMistakes(useChallengeMistakesStore((state) => state.saved), owner);
  const glossary = ownerStudy(useGlossaryStudyStore((state) => state.saved), owner);
  const reading = ownerReading(useReadingStore((state) => state.saved), owner);
  return useMemo(() => {
    const pathStates: Record<string, string[]> = {};
    for (const path of LEARNING_PATHS) pathStates[path.id] = pathProgress(path, pathSignals).states;
    const readingFurthest: Record<string, number> = {};
    for (const [key, record] of Object.entries(reading)) readingFurthest[key] = record.furthest;
    return { signals: { mistakes, glossary, pathStates, reading }, readingFurthest };
  }, [pathSignals, mistakes, glossary, reading]);
}
