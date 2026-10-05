/**
 * The private domains and their explicit, documented merge rules. Each
 * one maps an EXISTING per-owner store to small records - no store is
 * replaced and nothing is copied into a second store.
 *
 * Merge rules run only when the same record changed on two devices since
 * they last agreed (see reconcile.ts). `base` is the version both started
 * from, so counters are merged without double counting.
 */
import type { MistakeRecord } from '@/features/challenges/mistakes/mistakesModel';
import type { ReadingProgress } from '@/features/culture/reading/readingModel';
import type { ContentHighlight } from '@/features/culture/highlights/highlightsModel';
import { NOTE_MAX } from '@/features/culture/highlights/highlightsModel';
import type { GlossaryStudyRecord } from '@/features/culture/glossary/study/glossaryStudy';
import { addRecent, ruleFor, type GameSessionRecord } from '@/features/games/records/gameRecords';
import { isGoalSize, type GoalSize } from '@/features/goals/weeklyGoal';
import type { AudioBookmark, ListeningRecord } from '@/features/listening/listeningModel';
import { HISTORY_LIMIT } from '@/features/listening/listeningModel';
import { isSupportedType, type UserCollection, type UserCollectionItem } from '@/features/myCollections/myCollectionsModel';

import { mergeCounter, type DomainRules } from './reconcile';

export const PRIVATE_DOMAINS = [
  'reading',
  'highlights',
  'collections',
  'mistakes',
  'glossary_study',
  'glossary_sessions',
  'game_records',
  'komuz_favorites',
  'path_steps',
  'listening_history',
  'audio_bookmarks',
  'weekly_goal',
] as const;
export type PrivateDomain = (typeof PRIVATE_DOMAINS)[number];

// ---------------------------------------------------------------------
// Small validators (server JSON is the person's own data, but a bad row
// must never crash or corrupt a store - it is ignored instead).
// ---------------------------------------------------------------------
type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value);
const str = (value: unknown, max = 400): value is string => typeof value === 'string' && value.length <= max;
const iso = (value: unknown): value is string => str(value, 40) && !Number.isNaN(Date.parse(value));
const num = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const count = (value: unknown): value is number => num(value) && value >= 0 && Number.isInteger(value);
const later = (a: string, b: string) => (a > b ? a : b);
const earlier = (a: string, b: string) => (a < b ? a : b);
const earliestOf = (...values: (string | null | undefined)[]) => values.filter((value): value is string => !!value).sort()[0] ?? null;

// ---------------------------------------------------------------------
// Reading - key `contentType:contentId`.
// MERGE: furthest = max; resume point + lastReadAt from the newer read;
// completedAt = earliest (completed wins). DELETE: "Start over" removes
// the record (tombstone).
// ---------------------------------------------------------------------
export const readingRules: DomainRules<ReadingProgress> = {
  deletes: true,
  validate: (raw) =>
    isObj(raw) && (raw.contentType === 'culture_item' || raw.contentType === 'culture_material') && str(raw.contentId, 120) && num(raw.progress) && num(raw.furthest) && iso(raw.lastReadAt) && (raw.completedAt === null || iso(raw.completedAt))
      ? {
          contentType: raw.contentType,
          contentId: raw.contentId,
          progress: Math.min(1, Math.max(0, raw.progress)),
          furthest: Math.min(1, Math.max(0, raw.furthest)),
          lastReadAt: raw.lastReadAt,
          completedAt: raw.completedAt as string | null,
          // Reader Navigator: optional section key; anything malformed is dropped, never fatal.
          ...(typeof raw.lastSectionKey === 'string' && /^[a-z][a-z0-9_]{0,59}$/.test(raw.lastSectionKey) ? { lastSectionKey: raw.lastSectionKey } : {}),
        }
      : null,
  merge: (_base, local, server) => {
    const newer = local.lastReadAt > server.lastReadAt ? local : server;
    return { ...newer, furthest: Math.max(local.furthest, server.furthest), completedAt: earliestOf(local.completedAt, server.completedAt) };
  },
};

// ---------------------------------------------------------------------
// Highlights + PRIVATE notes - key = highlight id (section + language).
// MERGE: the newer edit (updatedAt) wins as a whole; createdAt earliest.
// DELETE: tombstone. Note text stays inside the owner's RLS-protected row.
// ---------------------------------------------------------------------
export const highlightRules: DomainRules<ContentHighlight> = {
  deletes: true,
  validate: (raw) =>
    isObj(raw) && str(raw.id, 300) && (raw.contentType === 'culture_item' || raw.contentType === 'culture_material') && str(raw.contentId, 120) && str(raw.sectionKey, 120) && str(raw.language, 8) && str(raw.titleSnapshot, 300) && str(raw.excerptSnapshot, 1600) && (raw.note === null || str(raw.note, NOTE_MAX)) && iso(raw.createdAt) && iso(raw.updatedAt)
      ? { id: raw.id, contentType: raw.contentType, contentId: raw.contentId, sectionKey: raw.sectionKey, language: raw.language, titleSnapshot: raw.titleSnapshot, excerptSnapshot: raw.excerptSnapshot, note: raw.note as string | null, createdAt: raw.createdAt, updatedAt: raw.updatedAt }
      : null,
  merge: (_base, local, server) => {
    const newer = local.updatedAt > server.updatedAt ? local : server;
    return { ...newer, createdAt: earlier(local.createdAt, server.createdAt) };
  },
};

// ---------------------------------------------------------------------
// My Collections - key = collection id; payload = the collection and its
// memberships. MERGE: name/description from the newer updatedAt;
// memberships three-way: the account's set, plus what this device added
// since base, minus what this device removed since base (so a removal
// isn't undone and an addition isn't lost). DELETE: tombstone - a deleted
// collection can't come back from a device that didn't edit it.
// ---------------------------------------------------------------------
export type CollectionMember = Omit<UserCollectionItem, 'collectionId'>;
export type CollectionRecord = { collection: UserCollection; items: CollectionMember[] };

const memberKey = (item: Pick<CollectionMember, 'contentType' | 'contentId'>) => `${item.contentType}:${item.contentId}`;

export const collectionRules: DomainRules<CollectionRecord> = {
  deletes: true,
  validate: (raw) => {
    if (!isObj(raw) || !isObj(raw.collection) || !Array.isArray(raw.items)) return null;
    const c = raw.collection;
    if (!str(c.id, 80) || !str(c.name, 80) || !(c.description === null || str(c.description, 300)) || !iso(c.createdAt) || !iso(c.updatedAt)) return null;
    const items: CollectionMember[] = [];
    for (const item of raw.items.slice(0, 500)) {
      if (isObj(item) && str(item.contentType, 40) && isSupportedType(item.contentType) && str(item.contentId, 160) && num(item.sortOrder) && iso(item.addedAt)) {
        items.push({ contentType: item.contentType, contentId: item.contentId, sortOrder: item.sortOrder, addedAt: item.addedAt });
      }
    }
    return { collection: { id: c.id, name: c.name, description: c.description as string | null, createdAt: c.createdAt, updatedAt: c.updatedAt }, items };
  },
  merge: (base, local, server) => {
    const newer = local.collection.updatedAt > server.collection.updatedAt ? local : server;
    const baseKeys = new Set((base?.items ?? []).map(memberKey));
    const localKeys = new Set(local.items.map(memberKey));
    const removedHere = new Set([...baseKeys].filter((key) => !localKeys.has(key)));
    const items = server.items.filter((item) => !removedHere.has(memberKey(item))).sort((a, b) => a.sortOrder - b.sortOrder);
    for (const item of [...local.items].sort((a, b) => a.sortOrder - b.sortOrder)) {
      if (!baseKeys.has(memberKey(item)) && !items.some((other) => memberKey(other) === memberKey(item))) items.push(item);
    }
    return {
      collection: { ...newer.collection, createdAt: earlier(local.collection.createdAt, server.collection.createdAt), updatedAt: later(local.collection.updatedAt, server.collection.updatedAt) },
      items: items.map((item, index) => ({ ...item, sortOrder: index })),
    };
  },
};

// ---------------------------------------------------------------------
// Challenge mistakes - key = questionId; payload = the open mistake (or
// null once corrected) + when it was last reviewed correctly.
// MERGE: the newest event decides the state (a later wrong answer
// re-opens it, a later correct review closes it); wrongCount three-way
// (no double counting); firstWrongAt earliest. DELETE: only when the
// question no longer exists (pruned) - tombstone.
// ---------------------------------------------------------------------
export type MistakeEntry = { active: MistakeRecord | null; reviewedAt: string | null };

const validMistake = (raw: unknown, questionId: string): MistakeRecord | null =>
  isObj(raw) && iso(raw.firstWrongAt) && iso(raw.lastWrongAt) && count(raw.wrongCount) && raw.wrongCount > 0 ? { questionId, firstWrongAt: raw.firstWrongAt, lastWrongAt: raw.lastWrongAt, wrongCount: raw.wrongCount } : null;

export const mistakeRules: DomainRules<MistakeEntry & { questionId: string }> = {
  deletes: true,
  validate: (raw) => {
    if (!isObj(raw) || !str(raw.questionId, 120)) return null;
    const active = raw.active === null ? null : validMistake(raw.active, raw.questionId);
    if (raw.active !== null && !active) return null;
    if (!(raw.reviewedAt === null || iso(raw.reviewedAt))) return null;
    if (!active && !raw.reviewedAt) return null;
    return { questionId: raw.questionId, active, reviewedAt: raw.reviewedAt as string | null };
  },
  merge: (base, local, server) => {
    const reviewedAt = [local.reviewedAt, server.reviewedAt].filter((value): value is string => !!value).sort().at(-1) ?? null;
    const lastWrong = [local.active?.lastWrongAt, server.active?.lastWrongAt].filter((value): value is string => !!value).sort().at(-1) ?? null;
    if (!lastWrong || (reviewedAt && reviewedAt >= lastWrong)) return { questionId: local.questionId, active: null, reviewedAt };
    const wrongCount = Math.max(1, mergeCounter(base?.active?.wrongCount ?? 0, local.active?.wrongCount ?? 0, server.active?.wrongCount ?? 0));
    return {
      questionId: local.questionId,
      active: { questionId: local.questionId, firstWrongAt: earliestOf(local.active?.firstWrongAt, server.active?.firstWrongAt) ?? lastWrong, lastWrongAt: lastWrong, wrongCount },
      reviewedAt,
    };
  },
};

// ---------------------------------------------------------------------
// Glossary study - key = glossary entry id.
// MERGE: seen/gotIt/reviewAgain counts three-way; lastReviewedAt newest;
// needsReview from the newest action. DELETE: pruned entries (tombstone).
// ---------------------------------------------------------------------
export const glossaryStudyRules: DomainRules<GlossaryStudyRecord> = {
  deletes: true,
  validate: (raw) =>
    isObj(raw) && str(raw.glossaryEntryId, 120) && count(raw.seenCount) && count(raw.gotItCount) && count(raw.reviewAgainCount) && iso(raw.lastReviewedAt) && typeof raw.needsReview === 'boolean'
      ? { glossaryEntryId: raw.glossaryEntryId, seenCount: raw.seenCount, gotItCount: raw.gotItCount, reviewAgainCount: raw.reviewAgainCount, lastReviewedAt: raw.lastReviewedAt, needsReview: raw.needsReview }
      : null,
  merge: (base, local, server) => {
    const newest = local.lastReviewedAt > server.lastReviewedAt ? local : server;
    return {
      glossaryEntryId: local.glossaryEntryId,
      seenCount: mergeCounter(base?.seenCount, local.seenCount, server.seenCount),
      gotItCount: mergeCounter(base?.gotItCount, local.gotItCount, server.gotItCount),
      reviewAgainCount: mergeCounter(base?.reviewAgainCount, local.reviewAgainCount, server.reviewAgainCount),
      lastReviewedAt: newest.lastReviewedAt,
      needsReview: newest.needsReview,
    };
  },
};

// ---------------------------------------------------------------------
// Glossary study sessions (Weekly Goals) - key = UTC month `YYYY-MM`;
// payload = completion times. MERGE: union. Never deleted (the local list
// is capped; an old month dropping off a device isn't a deletion).
// ---------------------------------------------------------------------
export type SessionMonth = { at: string[] };
export const glossarySessionRules: DomainRules<SessionMonth> = {
  deletes: false,
  normalizeLocal: (base, local) => ({ at: [...new Set([...base.at, ...local.at])].sort() }),
  validate: (raw) => (isObj(raw) && Array.isArray(raw.at) && raw.at.length <= 2000 && raw.at.every(iso) ? { at: [...new Set(raw.at as string[])].sort() } : null),
  merge: (_base, local, server) => ({ at: [...new Set([...local.at, ...server.at])].sort() }),
};

// ---------------------------------------------------------------------
// Game records / personal bests - key = gameId.
// MERGE: best by the game's own rule (higher / lower / none); recent
// rounds unioned by round id (newest 10); rounds played + wins three-way.
// Never deleted.
// ---------------------------------------------------------------------
/** `official` = finished official rounds (durable completion signal); optional
 * so records pushed by older app versions still validate. */
export type GameRecordEntry = { best: number | null; recent: GameSessionRecord[]; sessions: number; wins: number; official?: number };

export function betterBest(gameId: string, a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  const rule = ruleFor(gameId);
  if (rule?.best === 'lower') return Math.min(a, b);
  if (rule?.best === 'higher') return Math.max(a, b);
  return a;
}

const validSession = (raw: unknown): GameSessionRecord | null =>
  isObj(raw) && str(raw.id, 120) && str(raw.gameId, 60) && iso(raw.completedAt) && typeof raw.practice === 'boolean' && (raw.result === 'win' || raw.result === 'loss' || raw.result === 'draw' || raw.result === 'completed') && num(raw.primary) && isObj(raw.secondary) && Object.values(raw.secondary).every(num)
    ? { id: raw.id, gameId: raw.gameId, completedAt: raw.completedAt, practice: raw.practice, result: raw.result, primary: raw.primary, secondary: raw.secondary as Record<string, number> }
    : null;

export const gameRecordRules: DomainRules<GameRecordEntry> = {
    deletes: false,
    validate: (raw) => {
      if (!isObj(raw) || !(raw.best === null || num(raw.best)) || !count(raw.sessions) || !count(raw.wins) || !Array.isArray(raw.recent)) return null;
      const recent = raw.recent.slice(0, 10).map(validSession).filter((session): session is GameSessionRecord => !!session);
      return { best: raw.best as number | null, recent, sessions: raw.sessions, wins: raw.wins, ...(count(raw.official) ? { official: raw.official } : {}) };
    },
    merge: (base, local, server, gameId) => {
      let recent: GameSessionRecord[] = [];
      for (const session of [...local.recent, ...server.recent].sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.id.localeCompare(b.id))) recent = addRecent(recent, session);
      return {
        best: betterBest(gameId, local.best, server.best),
        recent,
        sessions: mergeCounter(base?.sessions, local.sessions, server.sessions),
        wins: mergeCounter(base?.wins, local.wins, server.wins),
        // Never below either side: a record from an older app (no field) can't erase it.
        official: Math.max(mergeCounter(base?.official ?? 0, local.official ?? 0, server.official ?? 0), local.official ?? 0, server.official ?? 0),
      };
    },
};

// ---------------------------------------------------------------------
// Komuz track favorites - key = track id, present = favorite.
// MERGE: same favorite. DELETE: unfavorite (tombstone).
// (Komuz "recently played" stays on the device: it is an untimed
// five-item queue; cross-device continuity is Listening History.)
// ---------------------------------------------------------------------
export type Flag = { favorite: true };
export const flagRules: DomainRules<Flag> = {
  deletes: true,
  validate: (raw) => (isObj(raw) && raw.favorite === true ? { favorite: true } : null),
  merge: (_base, local) => local,
};

// ---------------------------------------------------------------------
// Learning Path manual steps - key `pathId|stepId`, present = completed.
// MERGE: earliest completion. DELETE: "unmark" (tombstone).
// ---------------------------------------------------------------------
export type Presence = { at: string };
export const presenceRules: DomainRules<Presence> = {
  deletes: true,
  validate: (raw) => (isObj(raw) && iso(raw.at) ? { at: raw.at } : null),
  merge: (_base, local, server) => ({ at: earlier(local.at, server.at) }),
};

// ---------------------------------------------------------------------
// Listening history - key `source:id`. MERGE: the newer listen wins as a
// whole (its position is the real latest one). Never sent as a deletion:
// the history is capped at HISTORY_LIMIT, so dropping off is eviction.
// ---------------------------------------------------------------------
const source = (value: unknown): value is 'guide' | 'komuz' => value === 'guide' || value === 'komuz';
const positionType = (value: unknown): value is 'seconds' | 'chunk' => value === 'seconds' || value === 'chunk';

export const listeningHistoryRules: DomainRules<ListeningRecord> = {
  deletes: false,
  validate: (raw) =>
    isObj(raw) && str(raw.key, 200) && source(raw.sourceType) && str(raw.sourceId, 200) && str(raw.title, 300) && str(raw.route, 300) && raw.route.startsWith('/') && (raw.positionType === null || positionType(raw.positionType)) && (raw.position === null || count(raw.position)) && iso(raw.lastListenedAt) && typeof raw.completed === 'boolean'
      ? { key: raw.key, sourceType: raw.sourceType, sourceId: raw.sourceId, title: raw.title, route: raw.route, positionType: raw.positionType as ListeningRecord['positionType'], position: raw.position as number | null, lastListenedAt: raw.lastListenedAt, completed: raw.completed }
      : null,
  merge: (_base, local, server) => (local.lastListenedAt > server.lastListenedAt ? local : server),
};
export { HISTORY_LIMIT };

// ---------------------------------------------------------------------
// Audio bookmarks - key = bookmark id (immutable once made).
// MERGE: identical ids are the same point; the earlier copy is kept.
// DELETE: tombstone.
// ---------------------------------------------------------------------
export const bookmarkRules: DomainRules<AudioBookmark> = {
  deletes: true,
  validate: (raw) =>
    isObj(raw) && str(raw.id, 300) && source(raw.sourceType) && str(raw.sourceId, 200) && str(raw.title, 300) && str(raw.route, 300) && raw.route.startsWith('/') && positionType(raw.positionType) && count(raw.position) && iso(raw.createdAt)
      ? { id: raw.id, sourceType: raw.sourceType, sourceId: raw.sourceId, title: raw.title, route: raw.route, positionType: raw.positionType, position: raw.position, createdAt: raw.createdAt }
      : null,
  merge: (_base, local, server) => (local.createdAt <= server.createdAt ? local : server),
};

// ---------------------------------------------------------------------
// Weekly goal - one record `goal`. MERGE: the newest explicit choice
// (setAt) wins. The two small Home dates (celebrated week, "Not now")
// stay on the device on purpose.
// ---------------------------------------------------------------------
export type GoalRecord = { goal: GoalSize | null; setAt: string };
export const weeklyGoalRules: DomainRules<GoalRecord> = {
  deletes: false,
  validate: (raw) => (isObj(raw) && (raw.goal === null || isGoalSize(raw.goal)) && iso(raw.setAt) ? { goal: raw.goal as GoalSize | null, setAt: raw.setAt } : null),
  merge: (_base, local, server) => (local.setAt > server.setAt ? local : server),
};

export { memberKey };
