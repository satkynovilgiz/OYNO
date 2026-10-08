import type { Exhibition, ExhibitKey, ExhibitSlide } from './museumModel';

/**
 * Story Cards - the curator arranges up to six of the exhibition's own
 * exhibits into a short story. Each card may carry a short title and text
 * the curator writes (shown as theirs, apart from OYNO's information). The
 * parts follow the order: the first card is the beginning, the last the
 * ending, the rest the middle. Saved with the exhibition (same owner-bound
 * store); no new collection.
 */
export const STORY_MIN = 3;
export const STORY_MAX = 6;
export const CARD_TITLE_MAX = 40;
export const CARD_TEXT_MAX = 200;

export type StoryCard = { key: ExhibitKey; title: string; text: string };
export type Story = { cards: StoryCard[] };
export const EMPTY_STORY: Story = { cards: [] };
export type StoryPart = 'beginning' | 'middle' | 'ending';

const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/[<>{}]/g, '').slice(0, max) : '');

/** Re-checked on every read: only exhibits still in the exhibition, each once, at most six; text bounded. */
export function normalizeStory(raw: unknown, exhibition: Pick<Exhibition, 'exhibits'>): Story {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return EMPTY_STORY;
  const allowed = new Set(exhibition.exhibits);
  const seen = new Set<string>();
  const cards = (Array.isArray((raw as Story).cards) ? (raw as Story).cards : []).flatMap((card) => {
    if (!card || typeof card !== 'object' || typeof card.key !== 'string' || !allowed.has(card.key) || seen.has(card.key)) return [];
    seen.add(card.key);
    return [{ key: card.key, title: clean(card.title, CARD_TITLE_MAX), text: clean(card.text, CARD_TEXT_MAX) }];
  });
  return { cards: cards.slice(0, STORY_MAX) };
}

/** Add an exhibit as the next card (only one that can be shown now, at most six). */
export function addCard(story: Story, key: ExhibitKey, available: boolean): Story {
  if (!available || story.cards.length >= STORY_MAX || story.cards.some((card) => card.key === key)) return story;
  return { cards: [...story.cards, { key, title: '', text: '' }] };
}
export const removeCard = (story: Story, key: ExhibitKey): Story => ({ cards: story.cards.filter((card) => card.key !== key) });

export function moveCard(story: Story, index: number, delta: -1 | 1): Story {
  const target = index + delta;
  if (index < 0 || index >= story.cards.length || target < 0 || target >= story.cards.length) return story;
  const cards = [...story.cards];
  [cards[index], cards[target]] = [cards[target], cards[index]];
  return { cards };
}

export function setCardWords(story: Story, key: ExhibitKey, words: { title?: string; text?: string }): Story {
  if (!story.cards.some((card) => card.key === key)) return story;
  return { cards: story.cards.map((card) => (card.key === key ? { ...card, ...(words.title !== undefined ? { title: clean(words.title, CARD_TITLE_MAX) } : {}), ...(words.text !== undefined ? { text: clean(words.text, CARD_TEXT_MAX) } : {}) } : card)) };
}

export function partOf(index: number, count: number): StoryPart {
  if (index === 0) return 'beginning';
  if (index === count - 1) return 'ending';
  return 'middle';
}
export const canTell = (story: Story) => story.cards.length >= STORY_MIN;

export type StorySlide = { card: StoryCard; part: StoryPart; exhibit: ExhibitSlide | null };
/** The story as presented: every card in order with its exhibit (or null/removed - never breaking the rest). */
export function storySlides(story: Story, slides: readonly ExhibitSlide[]): StorySlide[] {
  const byKey = new Map(slides.map((slide) => [slide.key, slide]));
  return story.cards.map((card, index) => ({ card, part: partOf(index, story.cards.length), exhibit: byKey.get(card.key) ?? null }));
}

/** The one card to export: exactly what its preview shows (title, words, part, the exhibit's OYNO title and picture). */
export type StoryCardContent = { part: StoryPart; cardTitle: string; text: string; exhibitTitle: string | null; picture: unknown | null };
export function cardContent(slide: StorySlide): StoryCardContent {
  const shown = slide.exhibit?.kind === 'exhibit' ? slide.exhibit.content : null;
  return { part: slide.part, cardTitle: slide.card.title.trim(), text: slide.card.text.trim(), exhibitTitle: shown?.title ?? null, picture: shown?.thumbnail ?? null };
}

/** The presentation in progress survives the screen being re-created (opening a source) - memory only. */
let presenting: { owner: string; collectionId: string; index: number; asList: boolean } | null = null;
export const keepStoryPlace = (owner: string, collectionId: string, index: number, asList: boolean) => {
  presenting = { owner, collectionId, index, asList };
};
export const resumeStoryPlace = (owner: string, collectionId: string) => (presenting && presenting.owner === owner && presenting.collectionId === collectionId ? presenting : null);
export const endStoryPlace = () => {
  presenting = null;
};
