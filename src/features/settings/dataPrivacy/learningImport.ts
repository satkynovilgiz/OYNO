import { highlightId } from '@/features/culture/highlights/highlightsModel';
import {
  bookmarkRules,
  collectionRules,
  flagRules,
  gameRecordRules,
  glossarySessionRules,
  glossaryStudyRules,
  highlightRules,
  listeningHistoryRules,
  memberKey,
  mistakeRules,
  presenceRules,
  readingRules,
  weeklyGoalRules,
  type CollectionRecord,
  type PrivateDomain,
} from '@/services/sync/privateSync/domains';
import { samePayload, type DomainRules } from '@/services/sync/privateSync/reconcile';

import { EXPORT_FORMAT, EXPORT_SCHEMA, LEARNING_EXPORT_VERSION } from './learningExport';

/**
 * Safe Learning Data Restore - stage 1 (parse + validate) and the pure
 * merge plan. NOTHING here touches a store: the screen shows the preview,
 * and only an explicit "Import" applies the plan (applyLearningImport.ts).
 *
 * - Only OYNO's own export (schema + known version); arbitrary JSON, a
 *   newer version, unknown domains or malformed records reject the WHOLE
 *   file (no partial imports).
 * - Never imported: auth/session tokens, email/password, account/owner
 *   ids, analytics ids - such keys are ignored and reported.
 * - Ownership is decided by the CURRENT owner only, never by the file.
 * - Merge reuses Private Cloud Sync's domain rules (domains.ts). The
 *   backup is treated as a version the device already knew about for
 *   counters, so importing the same file twice never adds counts twice.
 * - Journal, photos, downloads, cached media are not part of the export
 *   and are never restored.
 */

export type LearningExportVersion = 1;
export const SUPPORTED_VERSIONS: readonly LearningExportVersion[] = [LEARNING_EXPORT_VERSION];

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ITEMS = 5000;
const MAX_DEPTH = 8;
const ID = /^[A-Za-z0-9][A-Za-z0-9_.:|-]{0,199}$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Top-level keys that hold credentials / identity: ignored, never imported. */
const SENSITIVE = /token|session|password|passwd|secret|email|user_?id|account_?id|owner|auth|analytics|device_?id|role|service/i;

export const IMPORT_DOMAINS = {
  readingProgress: 'reading',
  highlights: 'highlights',
  collections: 'collections',
  challengeReview: 'mistakes',
  glossaryStudy: 'glossary_study',
  gameRecords: 'game_records',
  komuzFavorites: 'komuz_favorites',
  learningPathSteps: 'path_steps',
  listening: 'listening_history',
  weeklyGoal: 'weekly_goal',
} as const satisfies Record<string, PrivateDomain>;
type ExportKey = keyof typeof IMPORT_DOMAINS;
const META_KEYS = new Set(['format', 'schema', 'version', 'exportedAt', 'domains']);

export type ImportError = 'too_large' | 'malformed' | 'wrong_schema' | 'newer_version' | 'invalid' | 'empty';

/** An export can't come from the future; a little clock skew is fine. A
 * far-future date would otherwise win "newest choice" merges (weekly goal) forever. */
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

/** Records per private domain, in the sync record shape (validated by the domain's own rules). */
export type DomainRecords = Partial<Record<PrivateDomain, Record<string, unknown>>>;

export type ParsedBackup = {
  version: LearningExportVersion;
  exportedAt: string;
  records: DomainRecords;
  /** Reliable counts for the preview. */
  counts: Partial<Record<PreviewKey, number>>;
  hasPrivateNotes: boolean;
  ignoredKeys: string[];
};
export type PreviewKey = 'reading' | 'highlights' | 'collections' | 'mistakes' | 'glossary' | 'games' | 'komuz' | 'pathSteps' | 'listening' | 'bookmarks' | 'weeklyGoal';

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value);
const iso = (value: unknown): value is string => typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value));

class Invalid extends Error {}
const fail = (): never => {
  throw new Invalid();
};
const id = (value: unknown): string => (typeof value === 'string' && ID.test(value) && !FORBIDDEN_KEYS.has(value) ? value : fail());
const list = (value: unknown): unknown[] => (Array.isArray(value) && value.length <= MAX_ITEMS ? value : fail());
const obj = (value: unknown): Obj => (isObj(value) && Object.keys(value).length <= MAX_ITEMS ? value : fail());
function put<P>(rules: DomainRules<P>, into: Record<string, unknown>, key: string, raw: unknown): void {
  const valid = rules.validate(raw);
  if (!valid || FORBIDDEN_KEYS.has(key)) fail();
  into[key] = valid;
}

/** No prototype keys anywhere, bounded depth and array sizes. */
function checkTree(value: unknown, depth = 0): void {
  if (depth > MAX_DEPTH) fail();
  if (Array.isArray(value)) {
    if (value.length > MAX_ITEMS) fail();
    for (const item of value) checkTree(item, depth + 1);
  } else if (isObj(value)) {
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(key) || key.length > 200) fail();
      checkTree(value[key], depth + 1);
    }
  } else if (typeof value === 'string' && value.length > 5000) fail();
}

export type ParseResult = { ok: true; backup: ParsedBackup } | { ok: false; error: ImportError };

/** Stage 1: parse + validate. Pure; never mutates any state. */
export function parseLearningBackup(text: string, sizeBytes = text.length, now = new Date()): ParseResult {
  if (sizeBytes > MAX_FILE_BYTES || text.length > MAX_FILE_BYTES) return { ok: false, error: 'too_large' };
  let raw: unknown;
  try {
    // Some editors save JSON with a byte-order mark; it is not part of the data.
    raw = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    return { ok: false, error: 'malformed' };
  }
  if (!isObj(raw)) return { ok: false, error: 'wrong_schema' };
  const version = raw.schema === EXPORT_SCHEMA && typeof raw.version === 'number' ? raw.version : raw.format === EXPORT_FORMAT ? 1 : null;
  if (version === null) return { ok: false, error: 'wrong_schema' };
  if (!(SUPPORTED_VERSIONS as readonly number[]).includes(version)) return { ok: false, error: version > LEARNING_EXPORT_VERSION ? 'newer_version' : 'wrong_schema' };
  if (!iso(raw.exportedAt)) return { ok: false, error: 'wrong_schema' };
  if (Date.parse(raw.exportedAt) > now.getTime() + MAX_CLOCK_SKEW_MS) return { ok: false, error: 'invalid' };
  try {
    checkTree(raw);
    const ignoredKeys: string[] = [];
    for (const key of Object.keys(raw)) {
      if (META_KEYS.has(key) || key in IMPORT_DOMAINS) continue;
      if (SENSITIVE.test(key)) ignoredKeys.push(key);
      else return { ok: false, error: 'invalid' }; // unknown domain
    }
    const backup = convert(raw, raw.exportedAt);
    const total = Object.values(backup.counts).reduce<number>((sum, value) => sum + (value ?? 0), 0);
    if (total === 0) return { ok: false, error: 'empty' };
    return { ok: true, backup: { ...backup, version: version as LearningExportVersion, exportedAt: raw.exportedAt, ignoredKeys } };
  } catch {
    return { ok: false, error: 'invalid' };
  }
}

function convert(raw: Obj, exportedAt: string): Omit<ParsedBackup, 'version' | 'exportedAt' | 'ignoredKeys'> {
  const records: Required<DomainRecords> = { reading: {}, highlights: {}, collections: {}, mistakes: {}, glossary_study: {}, glossary_sessions: {}, game_records: {}, komuz_favorites: {}, path_steps: {}, listening_history: {}, audio_bookmarks: {}, weekly_goal: {} };
  const has = (key: ExportKey) => Object.prototype.hasOwnProperty.call(raw, key) && raw[key] !== undefined;

  if (has('readingProgress'))
    for (const entry of list(raw.readingProgress)) {
      const row = obj(entry);
      // The export keeps the furthest point; resuming from there is the honest choice.
      put(readingRules, records.reading, `${row.contentType}:${id(row.contentId)}`, { ...row, progress: row.furthest });
    }
  let hasPrivateNotes = false;
  if (has('highlights'))
    for (const entry of list(raw.highlights)) {
      const row = obj(entry);
      const key = highlightId(row.contentType as never, id(row.contentId), id(row.sectionKey), String(row.language));
      put(highlightRules, records.highlights, key, { id: key, contentType: row.contentType, contentId: row.contentId, sectionKey: row.sectionKey, language: row.language, titleSnapshot: row.title, excerptSnapshot: row.passage, note: row.note ?? null, createdAt: row.createdAt, updatedAt: row.updatedAt });
      if (typeof row.note === 'string' && row.note.trim()) hasPrivateNotes = true;
    }
  if (has('collections'))
    for (const entry of list(raw.collections)) {
      const row = obj(entry);
      const items = list(row.items).map((item, index) => ({ ...obj(item), sortOrder: index }));
      // Identity: name + creation time (the export carries no device ids); the
      // apply step maps it onto an existing collection with the same identity.
      const key = importedCollectionId(String(row.name ?? ''), String(row.createdAt ?? ''));
      put(collectionRules, records.collections, key, { collection: { id: key, name: row.name, description: row.description ?? null, createdAt: row.createdAt, updatedAt: row.createdAt }, items });
      if ((records.collections[key] as CollectionRecord).items.length !== items.length) fail();
    }
  if (has('challengeReview')) {
    const review = obj(raw.challengeReview);
    const reviewed = review.reviewed === undefined ? {} : obj(review.reviewed);
    const open = review.open === undefined ? [] : list(review.open);
    const ids = new Set<string>([...open.map((entry) => id(obj(entry).questionId)), ...Object.keys(reviewed).map(id)]);
    for (const questionId of ids) {
      const active = open.map(obj).find((entry) => entry.questionId === questionId) ?? null;
      put(mistakeRules, records.mistakes, questionId, { questionId, active, reviewedAt: reviewed[questionId] ?? null });
    }
  }
  if (has('glossaryStudy')) {
    const study = obj(raw.glossaryStudy);
    for (const entry of list(study.terms ?? [])) put(glossaryStudyRules, records.glossary_study, id(obj(entry).glossaryEntryId), entry);
    const sessions = list(study.sessionsCompleted ?? []);
    if (!sessions.every(iso)) fail();
    for (const at of sessions as string[]) {
      const month = at.slice(0, 7);
      records.glossary_sessions[month] = { at: [...new Set([...((records.glossary_sessions[month] as { at: string[] } | undefined)?.at ?? []), at])].sort() };
    }
    for (const [month, value] of Object.entries(records.glossary_sessions)) put(glossarySessionRules, records.glossary_sessions, month, value);
  }
  if (has('gameRecords')) {
    const games = obj(raw.gameRecords);
    const best = obj(games.personalBests ?? {});
    const played = obj(games.roundsPlayed ?? {});
    const wins = obj(games.wins ?? {});
    const recent = obj(games.recentRounds ?? {});
    for (const gameId of new Set([...Object.keys(best), ...Object.keys(played), ...Object.keys(wins), ...Object.keys(recent)])) {
      id(gameId);
      const rounds = list(recent[gameId] ?? []);
      put(gameRecordRules, records.game_records, gameId, { best: best[gameId] ?? null, sessions: played[gameId] ?? 0, wins: wins[gameId] ?? 0, recent: rounds });
      if ((records.game_records[gameId] as { recent: unknown[] }).recent.length !== Math.min(10, rounds.length)) fail();
    }
  }
  if (has('komuzFavorites')) for (const trackId of list(raw.komuzFavorites)) put(flagRules, records.komuz_favorites, id(trackId), { favorite: true });
  if (has('learningPathSteps'))
    for (const [pathId, steps] of Object.entries(obj(raw.learningPathSteps))) {
      id(pathId);
      for (const [stepId, at] of Object.entries(obj(steps))) put(presenceRules, records.path_steps, `${pathId}|${id(stepId)}`, { at });
    }
  if (has('listening')) {
    const listening = obj(raw.listening);
    for (const entry of list(listening.history ?? [])) put(listeningHistoryRules, records.listening_history, id(obj(entry).key), entry);
    for (const entry of list(listening.bookmarks ?? [])) put(bookmarkRules, records.audio_bookmarks, id(obj(entry).id), entry);
  }
  if (has('weeklyGoal') && raw.weeklyGoal !== null) put(weeklyGoalRules, records.weekly_goal, 'goal', { goal: raw.weeklyGoal, setAt: exportedAt });

  const size = (domain: PrivateDomain) => Object.keys(records[domain]).length;
  const counts: ParsedBackup['counts'] = {
    reading: size('reading'),
    highlights: size('highlights'),
    collections: size('collections'),
    mistakes: size('mistakes'),
    glossary: size('glossary_study'),
    games: size('game_records'),
    komuz: size('komuz_favorites'),
    pathSteps: size('path_steps'),
    listening: size('listening_history'),
    bookmarks: size('audio_bookmarks'),
    weeklyGoal: size('weekly_goal'),
  };
  const nonEmpty: DomainRecords = {};
  for (const [domain, value] of Object.entries(records) as [PrivateDomain, Record<string, unknown>][]) if (Object.keys(value).length > 0) nonEmpty[domain] = value;
  return { records: nonEmpty, counts: Object.fromEntries(Object.entries(counts).filter(([, value]) => value > 0)), hasPrivateNotes };
}

/** Deterministic id for an imported collection (re-importing finds it again). */
export function importedCollectionId(name: string, createdAt: string): string {
  let h = 0x811c9dc5;
  for (const char of `${name.trim().toLowerCase()}|${createdAt}`) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return `uc_imp_${(h >>> 0).toString(36)}`;
}

// ---------------------------------------------------------------------
// Merge plan (pure). Uses each domain's sync merge rule.
// ---------------------------------------------------------------------

export const DOMAIN_RULES: Record<PrivateDomain, DomainRules<unknown>> = {
  reading: readingRules as DomainRules<unknown>,
  highlights: highlightRules as DomainRules<unknown>,
  collections: collectionRules as DomainRules<unknown>,
  mistakes: mistakeRules as DomainRules<unknown>,
  glossary_study: glossaryStudyRules as DomainRules<unknown>,
  glossary_sessions: glossarySessionRules as DomainRules<unknown>,
  game_records: gameRecordRules as DomainRules<unknown>,
  komuz_favorites: flagRules as DomainRules<unknown>,
  path_steps: presenceRules as DomainRules<unknown>,
  listening_history: listeningHistoryRules as DomainRules<unknown>,
  audio_bookmarks: bookmarkRules as DomainRules<unknown>,
  weekly_goal: weeklyGoalRules as DomainRules<unknown>,
};

export type DomainPlan = {
  domain: PrivateDomain;
  next: Record<string, unknown>;
  /** In the backup, not here: added. */
  added: number;
  /** In both, and the merge changes what is here. */
  updated: number;
  /** In both, and what is here already covers it. */
  unchanged: number;
  /** Deleted on this account earlier: not brought back. */
  skippedDeleted: number;
  /** Here, not in the backup: kept exactly as it is. */
  kept: number;
};

/**
 * One domain: current owner's records + the backup's -> merged records.
 * - key only in the backup: added (unless the account deleted it - a
 *   known tombstone is never resurrected);
 * - key in both: the domain's merge rule, with the backup as the shared
 *   base for counters (so counts become the larger value, never a sum).
 *   Collections merge memberships as an identity-safe union.
 * - local-only keys are always kept (merge never removes anything).
 */
export function planDomain(domain: PrivateDomain, current: Record<string, unknown>, imported: Record<string, unknown>, deletedKeys: ReadonlySet<string> = new Set()): DomainPlan {
  const rules = DOMAIN_RULES[domain];
  const next: Record<string, unknown> = { ...current };
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let skippedDeleted = 0;
  const incoming = domain === 'collections' ? alignCollections(current as Record<string, CollectionRecord>, imported as Record<string, CollectionRecord>) : imported;
  for (const [key, value] of Object.entries(incoming)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    const local = Object.prototype.hasOwnProperty.call(current, key) ? current[key] : undefined;
    if (local === undefined) {
      if (deletedKeys.has(key)) {
        skippedDeleted += 1;
        continue;
      }
      next[key] = value;
      added += 1;
      continue;
    }
    let merged = rules.merge(domain === 'collections' ? null : value, local, value, key);
    // Reading: the export only keeps the furthest point. When the backup is
    // not newer than what is here, the current resume position stays.
    if (domain === 'reading') merged = keepLocalResume(merged, local, value);
    if (!samePayload(merged, local)) {
      next[key] = merged;
      updated += 1;
    } else unchanged += 1;
  }
  const kept = Object.keys(current).filter((key) => !Object.prototype.hasOwnProperty.call(incoming, key)).length;
  return { domain, next, added, updated, unchanged, skippedDeleted, kept };
}

type ReadingLike = { progress: number; lastReadAt: string };
function keepLocalResume(merged: unknown, local: unknown, imported: unknown): unknown {
  const m = merged as ReadingLike;
  const l = local as ReadingLike;
  if ((imported as ReadingLike).lastReadAt > l.lastReadAt) return merged;
  return { ...m, progress: l.progress, lastReadAt: l.lastReadAt };
}

/** Maps imported collections onto existing ones with the same identity (name + created). */
function alignCollections(current: Record<string, CollectionRecord>, imported: Record<string, CollectionRecord>): Record<string, CollectionRecord> {
  const out: Record<string, CollectionRecord> = {};
  for (const record of Object.values(imported)) {
    const match = Object.values(current).find((existing) => existing.collection.createdAt === record.collection.createdAt && existing.collection.name.trim().toLowerCase() === record.collection.name.trim().toLowerCase());
    const key = match ? match.collection.id : record.collection.id;
    // An existing collection keeps its own name/description; only memberships are unioned.
    out[key] = { collection: match ? match.collection : record.collection, items: dedupeItems(record.items) };
  }
  return out;
}
const dedupeItems = (items: CollectionRecord['items']) => items.filter((item, index) => items.findIndex((other) => memberKey(other) === memberKey(item)) === index);

export const PREVIEW_ORDER: readonly PreviewKey[] = ['reading', 'collections', 'glossary', 'games', 'highlights', 'mistakes', 'pathSteps', 'komuz', 'listening', 'bookmarks', 'weeklyGoal'];
