import type { ShareCardContent } from '@/components/share/ShareCard';
import { colors } from '@/theme';

import { normalizeLook, type LookClosely } from './lookCloselyModel';
import { normalizeStory, type Story } from './storyModel';

import type { CollectionsData, ResolvedContent, UserCollection } from '../myCollectionsModel';

/**
 * Mini Museum - a presentation of an EXISTING private collection (no copy
 * of its items): an exhibition title, an optional introduction, up to
 * MAX_EXHIBITS of the collection's items in the owner's order, and the
 * owner's private captions. Captions and the introduction are the owner's
 * own words, kept per owner on this device and shown apart from the
 * sourced content (the item's own title / type / artwork).
 */
export const MAX_EXHIBITS = 8;
export const TITLE_MAX = 60;
export const INTRO_MAX = 280;
export const CAPTION_MAX = 200;

/** `<contentType>:<contentId>` - the collection item an exhibit shows. */
export type ExhibitKey = string;
/**
 * Reflection prompts the curator can place after an exhibit in the visitor
 * tour. AUTHORED, open questions for the visitor - not facts about the
 * object (texts: museum.visit.prompts.<id>).
 */
export const REFLECTION_PROMPTS = ['detail', 'reminds', 'askMaker', 'today', 'learnMore', 'share'] as const;
export type ReflectionPromptId = (typeof REFLECTION_PROMPTS)[number];

export type Exhibition = {
  title: string;
  intro: string;
  exhibits: ExhibitKey[];
  captions: Record<ExhibitKey, string>;
  /** Visitor tour: a reflection prompt after selected exhibits (added later; older exhibitions have none). */
  reflections?: Record<ExhibitKey, ReflectionPromptId>;
  /** Optional "Look Closely" activity (lookCloselyModel.ts); older exhibitions have none. */
  lookClosely?: LookClosely;
  /** Optional "Story Cards" (storyModel.ts); older exhibitions have none. */
  story?: Story;
  updatedAt: string;
};

export const exhibitKey = (item: { contentType: string; contentId: string }): ExhibitKey => `${item.contentType}:${item.contentId}`;

export function emptyExhibition(collection: Pick<UserCollection, 'name'>, data: CollectionsData, collectionId: string, now = new Date()): Exhibition {
  const items = data.items.filter((item) => item.collectionId === collectionId).sort((a, b) => a.sortOrder - b.sortOrder);
  return { title: collection.name.slice(0, TITLE_MAX), intro: '', exhibits: items.slice(0, MAX_EXHIBITS).map(exhibitKey), captions: {}, reflections: {}, updatedAt: now.toISOString() };
}

const clean = (value: string, max: number) => value.replace(/[<>{}]/g, '').slice(0, max);

/**
 * Re-checks an exhibition against its collection NOW: only items still in
 * the collection, no duplicates, at most MAX_EXHIBITS, captions only for
 * shown exhibits, text bounded. Used on every read, so a removed item or
 * a tampered value never reaches the screen.
 */
export function normalizeExhibition(raw: unknown, data: CollectionsData, collectionId: string): Exhibition | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Partial<Exhibition>;
  const inCollection = new Set(data.items.filter((item) => item.collectionId === collectionId).map(exhibitKey));
  const exhibits = Array.isArray(value.exhibits) ? [...new Set(value.exhibits.filter((key): key is string => typeof key === 'string' && inCollection.has(key)))].slice(0, MAX_EXHIBITS) : [];
  const captions: Record<ExhibitKey, string> = {};
  if (value.captions && typeof value.captions === 'object') {
    for (const key of exhibits) {
      const caption = (value.captions as Record<string, unknown>)[key];
      if (typeof caption === 'string' && caption.trim()) captions[key] = clean(caption, CAPTION_MAX);
    }
  }
  const reflections: Record<ExhibitKey, ReflectionPromptId> = {};
  if (value.reflections && typeof value.reflections === 'object') {
    for (const key of exhibits) {
      const prompt = (value.reflections as Record<string, unknown>)[key];
      if (typeof prompt === 'string' && (REFLECTION_PROMPTS as readonly string[]).includes(prompt)) reflections[key] = prompt as ReflectionPromptId;
    }
  }
  return {
    reflections,
    lookClosely: normalizeLook(value.lookClosely, { exhibits }),
    story: normalizeStory(value.story, { exhibits }),
    title: typeof value.title === 'string' ? clean(value.title, TITLE_MAX) : '',
    intro: typeof value.intro === 'string' ? clean(value.intro, INTRO_MAX) : '',
    exhibits,
    captions,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
  };
}

/** Adds (at the end, if there is room) or removes an exhibit. */
export function toggleExhibit(exhibition: Exhibition, key: ExhibitKey): Exhibition {
  if (exhibition.exhibits.includes(key)) {
    const captions = { ...exhibition.captions };
    delete captions[key];
    const reflections = { ...(exhibition.reflections ?? {}) };
    delete reflections[key];
    return { ...exhibition, exhibits: exhibition.exhibits.filter((item) => item !== key), captions, reflections };
  }
  if (exhibition.exhibits.length >= MAX_EXHIBITS) return exhibition;
  return { ...exhibition, exhibits: [...exhibition.exhibits, key] };
}

export function moveExhibit(exhibition: Exhibition, index: number, delta: -1 | 1): Exhibition {
  const target = index + delta;
  if (index < 0 || target < 0 || target >= exhibition.exhibits.length) return exhibition;
  const exhibits = [...exhibition.exhibits];
  [exhibits[index], exhibits[target]] = [exhibits[target], exhibits[index]];
  return { ...exhibition, exhibits };
}

/** Places (or removes, with null) a reflection prompt after one shown exhibit. */
export function setReflection(exhibition: Exhibition, key: ExhibitKey, prompt: ReflectionPromptId | null): Exhibition {
  if (!exhibition.exhibits.includes(key)) return exhibition;
  const reflections = { ...(exhibition.reflections ?? {}) };
  if (prompt) reflections[key] = prompt;
  else delete reflections[key];
  return { ...exhibition, reflections };
}

export function setCaption(exhibition: Exhibition, key: ExhibitKey, caption: string): Exhibition {
  if (!exhibition.exhibits.includes(key)) return exhibition;
  const captions = { ...exhibition.captions };
  const text = clean(caption, CAPTION_MAX);
  if (text.trim()) captions[key] = text;
  else delete captions[key];
  return { ...exhibition, captions };
}

export type ExhibitSlide =
  | { kind: 'exhibit'; key: ExhibitKey; content: ResolvedContent; caption: string | null; contentType: string }
  /** The item exists in the collection but the content itself is gone (removed from OYNO). */
  | { kind: 'removed'; key: ExhibitKey; caption: string | null; contentType: string }
  /** Still loading the catalogue - not yet known. */
  | { kind: 'loading'; key: ExhibitKey };

export function slidesFor(exhibition: Exhibition, resolve: (contentType: string, contentId: string) => ResolvedContent | null, ready: boolean): ExhibitSlide[] {
  return exhibition.exhibits.map((key) => {
    const [contentType, ...rest] = key.split(':');
    const content = resolve(contentType, rest.join(':'));
    const caption = exhibition.captions[key] ?? null;
    if (content) return { kind: 'exhibit', key, content, caption, contentType };
    return ready ? { kind: 'removed', key, caption, contentType } : { kind: 'loading', key };
  });
}

/**
 * The exhibition cover card for sharing - built ONLY from what the
 * preview shows: the title, how many exhibits, OYNO's label, the first
 * available exhibit's artwork, and the introduction ONLY when the owner
 * switches it on. Captions, the collection's private description, journal
 * text, notes and personal photos are not inputs, so they can't be included.
 */
export function buildExhibitionCover(input: { title: string; exhibitCountLabel: string; label: string; cover: ShareCardContent['imageSource']; intro: string | null }): ShareCardContent {
  return { title: input.title, label: input.label, subtitle: input.exhibitCountLabel, imageSource: input.cover, excerpt: input.intro?.trim() ? input.intro.trim() : null, fallbackTone: colors.surfaceFeature };
}
