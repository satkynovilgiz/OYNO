/**
 * Maps each EXISTING per-owner store to the record shape of its private
 * domain and back. Stores stay the source of truth on the device - these
 * adapters only read an owner's slice and write the merged slice back.
 */
import type { MistakesData } from '@/features/challenges/mistakes/mistakesModel';
import type { CollectionsData } from '@/features/myCollections/myCollectionsModel';
import { EMPTY_RECORDS, officialRounds, type OwnerRecords, useGameRecordsStore } from '@/store/useGameRecordsStore';
import { ownerMistakes, useChallengeMistakesStore } from '@/store/useChallengeMistakesStore';
import { ownerStudy, useGlossaryStudyStore } from '@/store/useGlossaryStudyStore';
import { ownerHighlights, useHighlightsStore } from '@/store/useHighlightsStore';
import { ownerLibrary, useKomuzLibraryStore } from '@/store/useKomuzLibraryStore';
import { ownerManualSteps, useLearningPathStore, type ManualSteps } from '@/store/useLearningPathStore';
import { ownerListening, useListeningStore } from '@/store/useListeningStore';
import { ownerCollections, useMyCollectionsStore } from '@/store/useMyCollectionsStore';
import { ownerReading, useReadingStore } from '@/store/useReadingStore';
import { ownerGoal, useWeeklyGoalStore } from '@/store/useWeeklyGoalStore';

import {
  bookmarkRules,
  collectionRules,
  flagRules,
  gameRecordRules,
  glossarySessionRules,
  glossaryStudyRules,
  highlightRules,
  HISTORY_LIMIT,
  listeningHistoryRules,
  mistakeRules,
  presenceRules,
  readingRules,
  weeklyGoalRules,
  type CollectionRecord,
  type GameRecordEntry,
  type MistakeEntry,
  type PrivateDomain,
} from './domains';
import type { DomainRules } from './reconcile';

type Records = Record<string, unknown>;

export type StoreAdapter = {
  domain: PrivateDomain;
  rules: DomainRules<unknown>;
  load: () => Promise<void>;
  /** Does this device hold ANY state for the owner (even an empty one)? */
  holds: (owner: string) => boolean;
  read: (owner: string) => Records;
  write: (owner: string, records: Records) => void;
  /** Removes the owner's slice from this device (sign-out after a clean sync). */
  forget: (owner: string) => void;
};

const has = (saved: Record<string, unknown>, owner: string) => Object.prototype.hasOwnProperty.call(saved, owner);
const rules = <P>(value: DomainRules<P>) => value as DomainRules<unknown>;

const reading: StoreAdapter = {
  domain: 'reading',
  rules: rules(readingRules),
  load: () => useReadingStore.getState().load(),
  holds: (owner) => has(useReadingStore.getState().saved, owner),
  read: (owner) => ({ ...ownerReading(useReadingStore.getState().saved, owner) }),
  write: (owner, records) => useReadingStore.getState().applySynced(owner, records as never),
  forget: (owner) => useReadingStore.getState().applySynced(owner, null),
};

const highlights: StoreAdapter = {
  domain: 'highlights',
  rules: rules(highlightRules),
  load: () => useHighlightsStore.getState().load(),
  holds: (owner) => has(useHighlightsStore.getState().saved, owner),
  read: (owner) => ({ ...ownerHighlights(useHighlightsStore.getState().saved, owner) }),
  write: (owner, records) => useHighlightsStore.getState().applySynced(owner, records as never),
  forget: (owner) => useHighlightsStore.getState().applySynced(owner, null),
};

const collections: StoreAdapter = {
  domain: 'collections',
  rules: rules(collectionRules),
  load: () => useMyCollectionsStore.getState().load(),
  holds: (owner) => has(useMyCollectionsStore.getState().saved, owner),
  read: (owner) => {
    const data = ownerCollections(useMyCollectionsStore.getState().saved, owner);
    const records: Record<string, CollectionRecord> = {};
    for (const collection of data.collections) {
      records[collection.id] = {
        collection,
        items: data.items
          .filter((item) => item.collectionId === collection.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(({ contentType, contentId, sortOrder, addedAt }) => ({ contentType, contentId, sortOrder, addedAt })),
      };
    }
    return records;
  },
  write: (owner, records) => {
    const list = Object.values(records as Record<string, CollectionRecord>).sort((a, b) => a.collection.createdAt.localeCompare(b.collection.createdAt) || a.collection.id.localeCompare(b.collection.id));
    const data: CollectionsData = {
      collections: list.map((record) => record.collection),
      items: list.flatMap((record) => record.items.map((item) => ({ ...item, collectionId: record.collection.id }))),
    };
    useMyCollectionsStore.getState().applySynced(owner, data);
  },
  forget: (owner) => useMyCollectionsStore.getState().applySynced(owner, null),
};

const mistakes: StoreAdapter = {
  domain: 'mistakes',
  rules: rules(mistakeRules),
  load: () => useChallengeMistakesStore.getState().load(),
  holds: (owner) => has(useChallengeMistakesStore.getState().saved, owner),
  read: (owner) => {
    const data = ownerMistakes(useChallengeMistakesStore.getState().saved, owner);
    const records: Record<string, MistakeEntry & { questionId: string }> = {};
    for (const id of new Set([...Object.keys(data.active), ...Object.keys(data.reviewedAt)])) {
      records[id] = { questionId: id, active: data.active[id] ?? null, reviewedAt: data.reviewedAt[id] ?? null };
    }
    return records;
  },
  write: (owner, records) => {
    const data: MistakesData = { active: {}, reviewedAt: {} };
    for (const [id, entry] of Object.entries(records as Record<string, MistakeEntry>)) {
      if (entry.active) data.active[id] = entry.active;
      if (entry.reviewedAt) data.reviewedAt[id] = entry.reviewedAt;
    }
    useChallengeMistakesStore.getState().applySynced(owner, data);
  },
  forget: (owner) => useChallengeMistakesStore.getState().applySynced(owner, null),
};

const glossaryStudy: StoreAdapter = {
  domain: 'glossary_study',
  rules: rules(glossaryStudyRules),
  load: () => useGlossaryStudyStore.getState().load(),
  holds: (owner) => has(useGlossaryStudyStore.getState().saved, owner),
  read: (owner) => ({ ...ownerStudy(useGlossaryStudyStore.getState().saved, owner) }),
  write: (owner, records) => useGlossaryStudyStore.getState().applySynced(owner, records as never),
  forget: (owner) => useGlossaryStudyStore.getState().applySynced(owner, null),
};

const glossarySessions: StoreAdapter = {
  domain: 'glossary_sessions',
  rules: rules(glossarySessionRules),
  load: () => useGlossaryStudyStore.getState().load(),
  holds: (owner) => has(useGlossaryStudyStore.getState().sessions, owner),
  read: (owner) => {
    const months: Record<string, { at: string[] }> = {};
    for (const at of useGlossaryStudyStore.getState().sessions[owner] ?? []) {
      const month = at.slice(0, 7);
      months[month] = { at: [...(months[month]?.at ?? []), at].sort() };
    }
    return months;
  },
  write: (owner, records) => {
    const all = Object.values(records as Record<string, { at: string[] }>).flatMap((month) => month.at);
    useGlossaryStudyStore.getState().applySyncedSessions(owner, [...new Set(all)].sort());
  },
  forget: (owner) => useGlossaryStudyStore.getState().applySyncedSessions(owner, null),
};

const gameRecords: StoreAdapter = {
  domain: 'game_records',
  rules: rules(gameRecordRules),
  load: () => useGameRecordsStore.getState().load(),
  holds: (owner) => has(useGameRecordsStore.getState().saved, owner),
  read: (owner) => {
    const data = useGameRecordsStore.getState().saved[owner] ?? EMPTY_RECORDS;
    const records: Record<string, GameRecordEntry> = {};
    for (const gameId of new Set([...Object.keys(data.recent), ...Object.keys(data.best), ...Object.keys(data.sessions), ...Object.keys(data.wins), ...Object.keys(data.official ?? {})])) {
      records[gameId] = { best: data.best[gameId] ?? null, recent: data.recent[gameId] ?? [], sessions: data.sessions[gameId] ?? 0, wins: data.wins[gameId] ?? 0, official: officialRounds(data, gameId) };
    }
    return records;
  },
  write: (owner, records) => {
    const data: OwnerRecords = { recent: {}, best: {}, sessions: {}, wins: {}, official: {} };
    for (const [gameId, entry] of Object.entries(records as Record<string, GameRecordEntry>)) {
      if (entry.recent.length > 0) data.recent[gameId] = entry.recent;
      if (entry.best !== null) data.best[gameId] = entry.best;
      if (entry.sessions > 0) data.sessions[gameId] = entry.sessions;
      if (entry.wins > 0) data.wins[gameId] = entry.wins;
      if ((entry.official ?? 0) > 0) data.official![gameId] = entry.official!;
    }
    useGameRecordsStore.getState().applySynced(owner, data);
  },
  forget: (owner) => useGameRecordsStore.getState().applySynced(owner, null),
};

const komuzFavorites: StoreAdapter = {
  domain: 'komuz_favorites',
  rules: rules(flagRules),
  load: () => useKomuzLibraryStore.getState().load(),
  holds: (owner) => has(useKomuzLibraryStore.getState().saved, owner),
  read: (owner) => Object.fromEntries(ownerLibrary(useKomuzLibraryStore.getState().saved, owner).favorites.map((id) => [id, { favorite: true }])),
  write: (owner, records) => {
    const current = ownerLibrary(useKomuzLibraryStore.getState().saved, owner).favorites;
    const keep = current.filter((id) => id in records);
    const added = Object.keys(records).filter((id) => !current.includes(id)).sort();
    useKomuzLibraryStore.getState().applySyncedFavorites(owner, [...keep, ...added]);
  },
  forget: (owner) => useKomuzLibraryStore.getState().applySyncedFavorites(owner, null),
};

const STEP_SEPARATOR = '|';
const pathSteps: StoreAdapter = {
  domain: 'path_steps',
  rules: rules(presenceRules),
  load: () => useLearningPathStore.getState().load(),
  holds: (owner) => has(useLearningPathStore.getState().saved, owner),
  read: (owner) => {
    const records: Record<string, { at: string }> = {};
    for (const [pathId, steps] of Object.entries(ownerManualSteps(useLearningPathStore.getState().saved, owner))) {
      for (const [stepId, at] of Object.entries(steps)) records[`${pathId}${STEP_SEPARATOR}${stepId}`] = { at };
    }
    return records;
  },
  write: (owner, records) => {
    const data: ManualSteps = {};
    for (const [key, value] of Object.entries(records as Record<string, { at: string }>)) {
      const [pathId, stepId] = key.split(STEP_SEPARATOR);
      if (!pathId || !stepId) continue;
      data[pathId] = { ...(data[pathId] ?? {}), [stepId]: value.at };
    }
    useLearningPathStore.getState().applySynced(owner, data);
  },
  forget: (owner) => useLearningPathStore.getState().applySynced(owner, null),
};

const listeningHistory: StoreAdapter = {
  domain: 'listening_history',
  rules: rules(listeningHistoryRules),
  load: () => useListeningStore.getState().load(),
  holds: (owner) => has(useListeningStore.getState().saved, owner),
  read: (owner) => ({ ...ownerListening(useListeningStore.getState().saved, owner).history }),
  write: (owner, records) => {
    const current = ownerListening(useListeningStore.getState().saved, owner);
    const newest = Object.entries(records as Record<string, { lastListenedAt: string }>)
      .sort((a, b) => b[1].lastListenedAt.localeCompare(a[1].lastListenedAt) || a[0].localeCompare(b[0]))
      .slice(0, HISTORY_LIMIT);
    useListeningStore.getState().applySynced(owner, { ...current, history: Object.fromEntries(newest) as never });
  },
  forget: (owner) => useListeningStore.getState().applySynced(owner, null),
};

const audioBookmarks: StoreAdapter = {
  domain: 'audio_bookmarks',
  rules: rules(bookmarkRules),
  load: () => useListeningStore.getState().load(),
  holds: (owner) => has(useListeningStore.getState().saved, owner),
  read: (owner) => ({ ...ownerListening(useListeningStore.getState().saved, owner).bookmarks }),
  write: (owner, records) => {
    const current = ownerListening(useListeningStore.getState().saved, owner);
    useListeningStore.getState().applySynced(owner, { ...current, bookmarks: records as never });
  },
  forget: (owner) => useListeningStore.getState().applySynced(owner, null),
};

const weeklyGoal: StoreAdapter = {
  domain: 'weekly_goal',
  rules: rules(weeklyGoalRules),
  load: () => useWeeklyGoalStore.getState().load(),
  holds: (owner) => has(useWeeklyGoalStore.getState().saved, owner),
  read: (owner) => {
    const settings = ownerGoal(useWeeklyGoalStore.getState().saved, owner);
    return settings.goalSetAt ? { goal: { goal: settings.goal, setAt: settings.goalSetAt } } : {};
  },
  write: (owner, records) => {
    const record = (records as Record<string, { goal: never; setAt: string }>).goal;
    if (record) useWeeklyGoalStore.getState().applySyncedGoal(owner, record);
  },
  forget: (owner) => useWeeklyGoalStore.getState().applySyncedGoal(owner, null),
};

export const STORE_ADAPTERS: readonly StoreAdapter[] = [
  reading,
  highlights,
  collections,
  mistakes,
  glossaryStudy,
  glossarySessions,
  gameRecords,
  komuzFavorites,
  pathSteps,
  listeningHistory,
  audioBookmarks,
  weeklyGoal,
];

/** Every store a private domain reads from (for change subscriptions). */
export const PRIVATE_STORES = [
  useReadingStore,
  useHighlightsStore,
  useMyCollectionsStore,
  useChallengeMistakesStore,
  useGlossaryStudyStore,
  useGameRecordsStore,
  useKomuzLibraryStore,
  useLearningPathStore,
  useListeningStore,
  useWeeklyGoalStore,
] as const;
