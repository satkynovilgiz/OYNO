import type { MistakesData } from '@/features/challenges/mistakes/mistakesModel';
import type { HighlightsData } from '@/features/culture/highlights/highlightsModel';
import type { ReadingData } from '@/features/culture/reading/readingModel';
import type { StudyData } from '@/features/culture/glossary/study/glossaryStudy';
import type { ListeningData } from '@/features/listening/listeningModel';
import type { CollectionsData } from '@/features/myCollections/myCollectionsModel';
import type { OwnerRecords } from '@/store/useGameRecordsStore';
import type { ManualSteps } from '@/store/useLearningPathStore';

/**
 * "Export my learning data" - the person's OWN learning state as plain
 * JSON. Only metadata OYNO stores for them; never: auth/session tokens,
 * account or device ids, analytics identifiers, or cached remote content
 * bodies (articles are referenced by id, not copied). Highlight notes are
 * included because the person explicitly confirmed it.
 */
export type LearningExportInput = {
  reading: ReadingData;
  highlights: HighlightsData;
  collections: CollectionsData;
  mistakes: MistakesData;
  glossaryStudy: StudyData;
  glossarySessions: string[];
  gameRecords: OwnerRecords;
  komuzFavorites: string[];
  pathSteps: ManualSteps;
  listening: ListeningData;
  weeklyGoal: number | null;
};

export const EXPORT_FORMAT = 'oyno-learning-data/1';
/** Explicit schema + version (read back by learningImport.ts). */
export const EXPORT_SCHEMA = 'oyno-learning-export';
export const LEARNING_EXPORT_VERSION = 1 as const;
export const EXPORT_DOMAINS = ['readingProgress', 'highlights', 'collections', 'challengeReview', 'glossaryStudy', 'gameRecords', 'komuzFavorites', 'learningPathSteps', 'listening', 'weeklyGoal'] as const;

export function buildLearningExport(input: LearningExportInput, now: Date): Record<string, unknown> {
  return {
    format: EXPORT_FORMAT,
    schema: EXPORT_SCHEMA,
    version: LEARNING_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    domains: EXPORT_DOMAINS,
    readingProgress: Object.values(input.reading).map(({ contentType, contentId, furthest, lastReadAt, completedAt }) => ({ contentType, contentId, furthest, lastReadAt, completedAt })),
    highlights: Object.values(input.highlights).map(({ contentType, contentId, sectionKey, language, titleSnapshot, excerptSnapshot, note, createdAt, updatedAt }) => ({ contentType, contentId, sectionKey, language, title: titleSnapshot, passage: excerptSnapshot, note, createdAt, updatedAt })),
    collections: input.collections.collections.map((collection) => ({
      name: collection.name,
      description: collection.description,
      createdAt: collection.createdAt,
      items: input.collections.items.filter((item) => item.collectionId === collection.id).sort((a, b) => a.sortOrder - b.sortOrder).map(({ contentType, contentId, addedAt }) => ({ contentType, contentId, addedAt })),
    })),
    challengeReview: { open: Object.values(input.mistakes.active), reviewed: input.mistakes.reviewedAt },
    glossaryStudy: { terms: Object.values(input.glossaryStudy), sessionsCompleted: input.glossarySessions },
    gameRecords: { personalBests: input.gameRecords.best, roundsPlayed: input.gameRecords.sessions, wins: input.gameRecords.wins, recentRounds: input.gameRecords.recent },
    komuzFavorites: input.komuzFavorites,
    learningPathSteps: input.pathSteps,
    listening: { history: Object.values(input.listening.history), bookmarks: Object.values(input.listening.bookmarks) },
    weeklyGoal: input.weeklyGoal,
  };
}

export function exportFileName(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `oyno-learning-data-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}
