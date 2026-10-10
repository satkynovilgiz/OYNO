import { CULTURE_CONNECTIONS, type ConnectionContentType, type CultureConnection } from '@/features/culture/connections/connectionsData';
import { linksFrom } from '@/features/culture/connections/connectionsModel';

import { NAME_MAX } from '../myCollectionsModel';
import { CAPTION_MAX, INTRO_MAX, type Exhibition } from './museumModel';

/**
 * Curator Challenge - a guided way INTO Mini Museum. A creative prompt,
 * three to five available articles in the curator's order, an
 * introduction and optional captions; saved as a normal private
 * collection with its exhibition (the existing owner-scoped workflow), so
 * it opens in the existing editing and visitor views.
 *
 * Prompts are creative guidance, not cultural claims. Requirements are
 * concrete and checkable (count, availability, introduction, name) - the
 * app never judges accuracy or quality, and gives no score.
 */
export const PROMPTS = ['introduce', 'story', 'compare'] as const;
export type PromptId = (typeof PROMPTS)[number];
export const MIN_PICKS = 3;
export const MAX_PICKS = 5;

export type Pick = { type: ConnectionContentType; id: string; titleSnapshot: string };
export type ChallengeDraft = { promptId: PromptId; name: string; intro: string; picks: Pick[]; captions: Record<string, string>; updatedAt: string };

export const pickKey = (pick: { type: string; id: string }) => `${pick.type}:${pick.id}`;
const clean = (value: string, max: number) => value.replace(/[<>{}]/g, '').slice(0, max);
const touch = (draft: ChallengeDraft, patch: Partial<ChallengeDraft>): ChallengeDraft => ({ ...draft, ...patch, updatedAt: new Date().toISOString() });

export const startDraft = (promptId: PromptId): ChallengeDraft => ({ promptId, name: '', intro: '', picks: [], captions: {}, updatedAt: new Date().toISOString() });

/** Changing the prompt keeps every pick, caption and word. */
export const setPrompt = (draft: ChallengeDraft, promptId: PromptId) => (draft.promptId === promptId ? draft : touch(draft, { promptId }));
export const setName = (draft: ChallengeDraft, name: string) => touch(draft, { name: clean(name, NAME_MAX) });
export const setIntro = (draft: ChallengeDraft, intro: string) => touch(draft, { intro: clean(intro, INTRO_MAX) });

export function togglePick(draft: ChallengeDraft, pick: Pick): ChallengeDraft {
  const key = pickKey(pick);
  if (draft.picks.some((entry) => pickKey(entry) === key)) {
    const captions = { ...draft.captions };
    delete captions[key];
    return touch(draft, { picks: draft.picks.filter((entry) => pickKey(entry) !== key), captions });
  }
  if (draft.picks.length >= MAX_PICKS) return draft;
  return touch(draft, { picks: [...draft.picks, { type: pick.type, id: pick.id, titleSnapshot: clean(pick.titleSnapshot, 120) }] });
}
export function movePick(draft: ChallengeDraft, index: number, delta: -1 | 1): ChallengeDraft {
  const target = index + delta;
  if (index < 0 || target < 0 || target >= draft.picks.length) return draft;
  const picks = [...draft.picks];
  [picks[index], picks[target]] = [picks[target], picks[index]];
  return touch(draft, { picks });
}
export function setCaption(draft: ChallengeDraft, key: string, caption: string): ChallengeDraft {
  if (!draft.picks.some((entry) => pickKey(entry) === key)) return draft;
  const captions = { ...draft.captions };
  const text = clean(caption, CAPTION_MAX);
  if (text.trim()) captions[key] = text;
  else delete captions[key];
  return touch(draft, { captions });
}

/* ---------- concrete requirements ---------- */

export type Section = 'prompt' | 'name' | 'picks' | 'intro' | 'captions';
export type Requirement = { id: 'count' | 'available' | 'intro' | 'name'; ok: boolean; section: Section; detail?: { count?: number; missing?: string[] } };

/** Only checkable conditions - never accuracy, quality or "how good". */
export function requirements(draft: ChallengeDraft, isAvailable: (pick: Pick) => boolean): Requirement[] {
  const missing = draft.picks.filter((pick) => !isAvailable(pick)).map(pickKey);
  return [
    { id: 'count', ok: draft.picks.length >= MIN_PICKS && draft.picks.length <= MAX_PICKS, section: 'picks', detail: { count: draft.picks.length } },
    { id: 'available', ok: missing.length === 0, section: 'picks', detail: { missing } },
    { id: 'intro', ok: draft.intro.trim().length > 0, section: 'intro' },
    { id: 'name', ok: draft.name.trim().length > 0, section: 'name' },
  ];
}
export const complete = (draft: ChallengeDraft, isAvailable: (pick: Pick) => boolean) => requirements(draft, isAvailable).every((entry) => entry.ok);

/* ---------- sourced connections (dataset only) ---------- */

/** Dataset entries linking two of the picked articles - shown with their own evidence. */
export function connectionsBetween(draft: ChallengeDraft, connections: readonly CultureConnection[] = CULTURE_CONNECTIONS): CultureConnection[] {
  const keys = new Set(draft.picks.map(pickKey));
  return connections.filter((connection) => keys.has(`${connection.fromType}:${connection.fromId}`) && keys.has(`${connection.toType}:${connection.toId}`));
}
/** Articles the dataset links to the picks (suggestions only; adding is the curator's choice). */
export function suggestedPicks(draft: ChallengeDraft): { type: ConnectionContentType; id: string; via: CultureConnection }[] {
  const keys = new Set(draft.picks.map(pickKey));
  const out: { type: ConnectionContentType; id: string; via: CultureConnection }[] = [];
  for (const pick of draft.picks)
    for (const link of linksFrom(pick.type, pick.id)) {
      const key = `${link.otherType}:${link.otherId}`;
      if (!keys.has(key) && !out.some((entry) => `${entry.type}:${entry.id}` === key)) out.push({ type: link.otherType, id: link.otherId, via: link.connection });
    }
  return out;
}

/** The exhibition this draft becomes (the existing Exhibition shape). */
export function toExhibition(draft: ChallengeDraft, now = new Date()): Exhibition {
  const exhibits = draft.picks.map(pickKey);
  const captions: Record<string, string> = {};
  for (const key of exhibits) if (draft.captions[key]?.trim()) captions[key] = draft.captions[key];
  return { title: draft.name.trim(), intro: draft.intro.trim(), exhibits, captions, reflections: {}, updatedAt: now.toISOString() };
}

export function normalizeDraft(raw: unknown): ChallengeDraft | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Partial<ChallengeDraft>;
  const picks: Pick[] = [];
  for (const pick of Array.isArray(value.picks) ? value.picks : []) {
    if (!pick || (pick.type !== 'culture_item' && pick.type !== 'culture_material') || typeof pick.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(pick.id)) continue;
    if (picks.length < MAX_PICKS && !picks.some((entry) => pickKey(entry) === pickKey(pick))) picks.push({ type: pick.type, id: pick.id, titleSnapshot: typeof pick.titleSnapshot === 'string' ? clean(pick.titleSnapshot, 120) : '' });
  }
  const keys = new Set(picks.map(pickKey));
  const captions: Record<string, string> = {};
  if (value.captions && typeof value.captions === 'object') for (const [key, text] of Object.entries(value.captions)) if (keys.has(key) && typeof text === 'string' && text.trim()) captions[key] = clean(text, CAPTION_MAX);
  return {
    promptId: (PROMPTS as readonly string[]).includes(value.promptId as string) ? (value.promptId as PromptId) : 'introduce',
    name: typeof value.name === 'string' ? clean(value.name, NAME_MAX) : '',
    intro: typeof value.intro === 'string' ? clean(value.intro, INTRO_MAX) : '',
    picks,
    captions,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
  };
}
