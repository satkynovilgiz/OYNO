import { CULTURE_CONNECTIONS, type ConnectionContentType, type CultureConnection } from '@/features/culture/connections/connectionsData';
import { connectionById, linksFrom } from '@/features/culture/connections/connectionsModel';

/**
 * Culture Discovery Board - a personal question around existing OYNO
 * articles. Two kinds of link, never mixed up:
 *
 * - SOURCED: a reference to an entry of OYNO's curated connections dataset
 *   (connectionsData.ts). Shown with that entry's own evidence excerpt,
 *   article and section. A board can only attach a dataset entry whose two
 *   articles are both on the board; nothing is inferred.
 * - OBSERVATION: the user's own words, always labelled as theirs. A note
 *   never becomes (or suggests) an authoritative connection.
 *
 * Cards keep the title they had when added, so a card whose article later
 * becomes unavailable still reads sensibly (marked unavailable) and its
 * notes are kept.
 */
export const MAX_CARDS = 8;
export const MAX_BOARDS = 20;
export const QUESTION_MAX = 160;
export const TITLE_MAX = 60;
export const NOTE_MAX = 400;
export const MAX_LINKS = 40;

/** Neutral prompts (texts: discoveryBoard.prompts.<id>) - questions, not claims. */
export const PROMPTS = ['connects', 'usedTogether', 'learnMore', 'differences'] as const;
export type PromptId = (typeof PROMPTS)[number];

export type CardRef = { type: ConnectionContentType; id: string };
export type BoardCard = CardRef & { titleSnapshot: string };
export type SourcedLink = { id: string; kind: 'sourced'; connectionId: string };
/** `cards`: the 0-2 cards it is about (empty = about the whole board). */
export type ObservationLink = { id: string; kind: 'observation'; text: string; cards: string[] };
export type BoardLink = SourcedLink | ObservationLink;

export type Board = {
  id: string;
  title: string;
  /** The user's own question, or a chosen neutral prompt. */
  question: string;
  promptId: PromptId | null;
  cards: BoardCard[];
  links: BoardLink[];
  createdAt: string;
  updatedAt: string;
};

export const cardKey = (card: CardRef): string => `${card.type}:${card.id}`;
const clean = (value: string, max: number) => value.replace(/[<>{}]/g, '').slice(0, max);
const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;
const TYPES: readonly string[] = ['culture_item', 'culture_material'];
let counter = 0;
const newId = (prefix: string, now: Date) => `${prefix}${now.getTime().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function createBoard(start: BoardCard, input: { question: string; promptId: PromptId | null; title: string }, now = new Date()): Board {
  return {
    id: newId('b', now),
    title: clean(input.title, TITLE_MAX),
    question: clean(input.question, QUESTION_MAX),
    promptId: input.promptId,
    cards: [{ type: start.type, id: start.id, titleSnapshot: clean(start.titleSnapshot, 120) }],
    links: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

const touch = (board: Board, patch: Partial<Board>, now = new Date()): Board => ({ ...board, ...patch, updatedAt: now.toISOString() });

export const rename = (board: Board, title: string) => touch(board, { title: clean(title, TITLE_MAX) });
export const setQuestion = (board: Board, question: string, promptId: PromptId | null = null) => touch(board, { question: clean(question, QUESTION_MAX), promptId });

export function addCard(board: Board, card: BoardCard): Board {
  if (board.cards.length >= MAX_CARDS || board.cards.some((entry) => cardKey(entry) === cardKey(card))) return board;
  return touch(board, { cards: [...board.cards, { type: card.type, id: card.id, titleSnapshot: clean(card.titleSnapshot, 120) }] });
}

/**
 * Removes a card. Sourced links that need it go (they no longer have both
 * articles); the user's observations are KEPT - just no longer pointing at
 * that card.
 */
export function removeCard(board: Board, key: string): Board {
  if (!board.cards.some((card) => cardKey(card) === key)) return board;
  const cards = board.cards.filter((card) => cardKey(card) !== key);
  const keys = new Set(cards.map(cardKey));
  const links = board.links.flatMap((link): BoardLink[] => {
    if (link.kind === 'observation') return [{ ...link, cards: link.cards.filter((entry) => entry !== key) }];
    const connection = connectionById(link.connectionId);
    return connection && keys.has(`${connection.fromType}:${connection.fromId}`) && keys.has(`${connection.toType}:${connection.toId}`) ? [link] : [];
  });
  return touch(board, { cards, links });
}

export function moveCard(board: Board, index: number, delta: -1 | 1): Board {
  const target = index + delta;
  if (index < 0 || target < 0 || target >= board.cards.length) return board;
  const cards = [...board.cards];
  [cards[index], cards[target]] = [cards[target], cards[index]];
  return touch(board, { cards });
}

/** Dataset entries whose two articles are both on the board and that aren't attached yet - the ONLY sourced connections that can be attached. */
export function availableConnections(board: Board, connections: readonly CultureConnection[] = CULTURE_CONNECTIONS): CultureConnection[] {
  const keys = new Set(board.cards.map(cardKey));
  const attached = new Set(board.links.flatMap((link) => (link.kind === 'sourced' ? [link.connectionId] : [])));
  return connections.filter((connection) => keys.has(`${connection.fromType}:${connection.fromId}`) && keys.has(`${connection.toType}:${connection.toId}`) && !attached.has(connection.id));
}

/** Articles linked by the dataset to cards already on the board (suggested next cards - still the user's choice). */
export function connectedSuggestions(board: Board): CardRef[] {
  const keys = new Set(board.cards.map(cardKey));
  const out: CardRef[] = [];
  for (const card of board.cards)
    for (const link of linksFrom(card.type, card.id)) {
      const key = `${link.otherType}:${link.otherId}`;
      if (!keys.has(key) && !out.some((entry) => cardKey(entry) === key)) out.push({ type: link.otherType, id: link.otherId });
    }
  return out;
}

export function attachConnection(board: Board, connectionId: string): Board {
  if (board.links.length >= MAX_LINKS || !availableConnections(board).some((connection) => connection.id === connectionId)) return board;
  return touch(board, { links: [...board.links, { id: newId('l', new Date()), kind: 'sourced', connectionId }] });
}

export function addObservation(board: Board, text: string, cards: string[]): Board {
  const body = clean(text, NOTE_MAX).trim();
  if (!body || board.links.length >= MAX_LINKS) return board;
  const keys = new Set(board.cards.map(cardKey));
  return touch(board, { links: [...board.links, { id: newId('l', new Date()), kind: 'observation', text: body, cards: [...new Set(cards.filter((key) => keys.has(key)))].slice(0, 2) }] });
}

export const removeLink = (board: Board, linkId: string) => touch(board, { links: board.links.filter((link) => link.id !== linkId) });

/** Stored data back into a Board: bounded, typed; unknown kinds dropped. Content availability is NOT checked here (see `reviewBoard`). */
export function normalizeBoard(raw: unknown): Board | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Partial<Board>;
  if (typeof value.id !== 'string' || !SAFE_ID.test(value.id)) return null;
  const cards: BoardCard[] = [];
  for (const card of Array.isArray(value.cards) ? value.cards : []) {
    if (!card || typeof card !== 'object' || !TYPES.includes(card.type) || typeof card.id !== 'string' || !SAFE_ID.test(card.id)) continue;
    if (cards.some((entry) => cardKey(entry) === cardKey(card)) || cards.length >= MAX_CARDS) continue;
    cards.push({ type: card.type, id: card.id, titleSnapshot: typeof card.titleSnapshot === 'string' ? clean(card.titleSnapshot, 120) : '' });
  }
  const keys = new Set(cards.map(cardKey));
  const links: BoardLink[] = [];
  for (const link of Array.isArray(value.links) ? value.links.slice(0, MAX_LINKS) : []) {
    if (!link || typeof link !== 'object' || typeof link.id !== 'string') continue;
    if (link.kind === 'sourced' && typeof link.connectionId === 'string') links.push({ id: link.id, kind: 'sourced', connectionId: link.connectionId });
    if (link.kind === 'observation' && typeof link.text === 'string' && link.text.trim())
      links.push({ id: link.id, kind: 'observation', text: clean(link.text, NOTE_MAX), cards: Array.isArray(link.cards) ? link.cards.filter((key): key is string => typeof key === 'string' && keys.has(key)).slice(0, 2) : [] });
  }
  return {
    id: value.id,
    title: typeof value.title === 'string' ? clean(value.title, TITLE_MAX) : '',
    question: typeof value.question === 'string' ? clean(value.question, QUESTION_MAX) : '',
    promptId: (PROMPTS as readonly string[]).includes(value.promptId as string) ? (value.promptId as PromptId) : null,
    cards,
    links,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
  };
}

/* ---------- the readable review ---------- */

export type ReviewCard = { key: string; position: number; type: ConnectionContentType; id: string; title: string; available: boolean };
export type ReviewLink =
  | { id: string; kind: 'sourced'; connection: CultureConnection; fromTitle: string; toTitle: string; sourceTitle: string; field: string; sourceAvailable: boolean }
  /** A stored reference that no longer resolves to the dataset: kept visible, never shown as authoritative. */
  | { id: string; kind: 'missingConnection'; connectionId: string }
  | { id: string; kind: 'observation'; text: string; about: string[] };

/**
 * The board as it reads NOW: every card (unavailable ones marked, with
 * their remembered title), every sourced link resolved against the
 * dataset (evidence + article + section), every observation labelled as
 * the user's. Nothing is dropped silently.
 */
export function reviewBoard(board: Board, resolveTitle: (type: ConnectionContentType, id: string) => string | null, connections: readonly CultureConnection[] = CULTURE_CONNECTIONS): { cards: ReviewCard[]; links: ReviewLink[] } {
  const cards = board.cards.map((card, position) => {
    const live = resolveTitle(card.type, card.id);
    return { key: cardKey(card), position, type: card.type, id: card.id, title: live ?? card.titleSnapshot, available: live !== null };
  });
  const titleOf = (type: ConnectionContentType, id: string) => resolveTitle(type, id) ?? board.cards.find((card) => card.type === type && card.id === id)?.titleSnapshot ?? id;
  const links = board.links.map((link): ReviewLink => {
    if (link.kind === 'observation') return { id: link.id, kind: 'observation', text: link.text, about: link.cards.map((key) => cards.find((card) => card.key === key)?.title ?? key) };
    const connection = connectionById(link.connectionId, connections);
    if (!connection) return { id: link.id, kind: 'missingConnection', connectionId: link.connectionId };
    return {
      id: link.id,
      kind: 'sourced',
      connection,
      fromTitle: titleOf(connection.fromType, connection.fromId),
      toTitle: titleOf(connection.toType, connection.toId),
      sourceTitle: titleOf(connection.source.contentType, connection.source.contentId),
      field: connection.source.field,
      sourceAvailable: resolveTitle(connection.source.contentType, connection.source.contentId) !== null,
    };
  });
  return { cards, links };
}
