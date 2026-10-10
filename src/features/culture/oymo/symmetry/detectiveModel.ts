import type { MotifLayer, OymoEditorState } from '@/services/culture/oymoEditor';
import { colors } from '@/theme';

import { cellKey, centre, GRID, type Cell } from './playgroundModel';
import { REMEMBER_PATTERNS, validatePattern, type Level } from './rememberModel';

/**
 * Pattern Detective - spot what changed between an original pattern and a
 * modified copy. Patterns are the authored Remember the Pattern ones (same
 * 5 x 5 grid, same motifs). Every change is generated and TRACKED
 * explicitly; the changed cells are then re-derived by comparing the two
 * models cell by cell, and a challenge is only used when both agree - so
 * the answer always matches what is drawn. No screenshots, no timing.
 */
export const LEVELS: Level[] = ['easy', 'medium', 'hard'];
export const CHANGED_CELLS: Record<Level, number> = { easy: 1, medium: 2, hard: 3 };
/** Motif colours on the detective grids (all theme colours; names in patternDetective.colors.*). */
export const DETECTIVE_COLORS: Record<string, string> = { green: colors.primary, terracotta: colors.accentTerracotta, gold: colors.accentGoldPressed, brown: colors.accentBrownDark };
export const BASE_COLOR = 'green';
const COLOR_IDS = Object.keys(DETECTIVE_COLORS);
/** The motifs used by the authored patterns (replace / add draw from these). */
export const DETECTIVE_MOTIFS = [...new Set(REMEMBER_PATTERNS.flatMap((pattern) => pattern.marks.map((mark) => mark.motifId)))];

export type Content = { motifId: string; color: string };
export type DetectiveMark = Content & { cell: Cell };
export type Grid = DetectiveMark[];

export type Change =
  | { kind: 'add'; cell: Cell; after: Content }
  | { kind: 'remove'; cell: Cell; before: Content }
  | { kind: 'replace'; cell: Cell; before: Content; after: Content }
  | { kind: 'recolor'; cell: Cell; before: Content; after: Content }
  /** A moved motif changes TWO cells: where it was (now empty) and where it went (now filled). */
  | { kind: 'move'; from: Cell; to: Cell; before: Content };

export const cellsOf = (change: Change): Cell[] => (change.kind === 'move' ? [change.from, change.to] : [change.cell]);
const copyGrid = (grid: readonly DetectiveMark[]): Grid => grid.map((mark) => ({ motifId: mark.motifId, color: mark.color, cell: { col: mark.cell.col, row: mark.cell.row } }));
const at = (grid: readonly DetectiveMark[], cell: Cell) => grid.find((mark) => cellKey(mark.cell) === cellKey(cell)) ?? null;
const same = (a: Content | null, b: Content | null) => (a === null && b === null) || (!!a && !!b && a.motifId === b.motifId && a.color === b.color);

/** Applies changes to a COPY (the original is never touched). */
export function applyChanges(original: readonly DetectiveMark[], changes: readonly Change[]): Grid {
  let grid = copyGrid(original);
  const without = (cell: Cell) => (grid = grid.filter((mark) => cellKey(mark.cell) !== cellKey(cell)));
  for (const change of changes) {
    if (change.kind === 'move') {
      without(change.from);
      without(change.to);
      grid.push({ ...change.before, cell: { ...change.to } });
    } else {
      without(change.cell);
      if (change.kind !== 'remove') grid.push({ ...change.after, cell: { ...change.cell } });
    }
  }
  return grid;
}

/** Cells whose drawn content differs - derived from the two models, independently of the change list. */
export function diffCells(original: readonly DetectiveMark[], modified: readonly DetectiveMark[]): string[] {
  const keys = new Set([...original, ...modified].map((mark) => cellKey(mark.cell)));
  return [...keys].filter((key) => {
    const [col, row] = key.split(',').map(Number);
    return !same(at(original, { col, row }), at(modified, { col, row }));
  }).sort();
}

export type Challenge = { id: string; level: Level; patternId: string; original: Grid; modified: Grid; changes: Change[]; changed: string[] };

/** A small seeded generator, so a challenge can be reproduced in tests. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}
const pick = <T,>(items: readonly T[], random: () => number): T => items[Math.floor(random() * items.length)];

/** Splits N changed cells into changes: a move counts as two cells. */
function plan(cells: number, random: () => number): ('single' | 'move')[] {
  const out: ('single' | 'move')[] = [];
  let left = cells;
  while (left > 0) {
    const move = left >= 2 && random() < 0.35;
    out.push(move ? 'move' : 'single');
    left -= move ? 2 : 1;
  }
  return out;
}

/** One candidate challenge (may be rejected by `generateChallenge`). */
function candidate(level: Level, random: () => number): Challenge | null {
  const pattern = pick(REMEMBER_PATTERNS, random);
  if (validatePattern(pattern).length) return null;
  const original: Grid = pattern.marks.map((mark) => ({ motifId: mark.motifId, color: BASE_COLOR, cell: { ...mark.cell } }));
  const used = new Set<string>();
  const all = Array.from({ length: GRID * GRID }, (_, index) => ({ col: index % GRID, row: Math.floor(index / GRID) }));
  const free = () => all.filter((cell) => !used.has(cellKey(cell)) && !at(original, cell));
  const filled = () => original.filter((mark) => !used.has(cellKey(mark.cell)));
  const changes: Change[] = [];
  for (const step of plan(CHANGED_CELLS[level], random)) {
    if (step === 'move') {
      const from = filled();
      const to = free();
      if (!from.length || !to.length) return null;
      const mark = pick(from, random);
      const target = pick(to, random);
      changes.push({ kind: 'move', from: { ...mark.cell }, to: target, before: { motifId: mark.motifId, color: mark.color } });
      used.add(cellKey(mark.cell)).add(cellKey(target));
      continue;
    }
    const kind = pick(['add', 'remove', 'replace', 'recolor'] as const, random);
    if (kind === 'add') {
      const options = free();
      if (!options.length) return null;
      const cell = pick(options, random);
      changes.push({ kind, cell, after: { motifId: pick(DETECTIVE_MOTIFS, random), color: pick(COLOR_IDS, random) } });
      used.add(cellKey(cell));
    } else {
      const options = filled();
      if (!options.length) return null;
      const mark = pick(options, random);
      const before = { motifId: mark.motifId, color: mark.color };
      if (kind === 'remove') changes.push({ kind, cell: { ...mark.cell }, before });
      if (kind === 'replace') changes.push({ kind, cell: { ...mark.cell }, before, after: { motifId: pick(DETECTIVE_MOTIFS.filter((id) => id !== mark.motifId), random), color: mark.color } });
      if (kind === 'recolor') changes.push({ kind, cell: { ...mark.cell }, before, after: { motifId: mark.motifId, color: pick(COLOR_IDS.filter((id) => id !== mark.color), random) } });
      used.add(cellKey(mark.cell));
    }
  }
  const modified = applyChanges(original, changes);
  const tracked = [...new Set(changes.flatMap((change) => cellsOf(change).map(cellKey)))].sort();
  return { id: `${pattern.id}-${Math.floor(random() * 1e9).toString(36)}`, level, patternId: pattern.id, original, modified, changes, changed: tracked };
}

/**
 * A challenge with EXACTLY the level's number of changed cells, where the
 * tracked cells equal the cells whose drawn content differs, and the
 * modified pattern keeps at least one motif.
 */
export function generateChallenge(level: Level, random: () => number = Math.random): Challenge {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const challenge = candidate(level, random);
    if (!challenge) continue;
    const derived = diffCells(challenge.original, challenge.modified);
    if (challenge.changed.length === CHANGED_CELLS[level] && derived.join('|') === challenge.changed.join('|') && challenge.modified.length > 0) return challenge;
  }
  throw new Error(`no ${level} challenge could be generated`);
}

/* ---------- the attempt ---------- */

export type Attempt = { challenge: Challenge; marked: string[]; checks: number; hints: string[]; feedback: Feedback | null; done: boolean };
export type Feedback = { found: number; missed: number; extra: number; solved: boolean };

export const startAttempt = (challenge: Challenge): Attempt => ({ challenge, marked: [], checks: 0, hints: [], feedback: null, done: false });

export function check(challenge: Challenge, marked: readonly string[]): Feedback {
  const want = new Set(challenge.changed);
  const found = marked.filter((key) => want.has(key)).length;
  const extra = marked.length - found;
  const missed = want.size - found;
  return { found, missed, extra, solved: missed === 0 && extra === 0 };
}

export type AttemptAction = { type: 'toggle'; key: string } | { type: 'check' } | { type: 'hint' } | { type: 'restart' };

export function attemptReducer(state: Attempt, action: AttemptAction): Attempt {
  if (state.done && action.type !== 'restart') return state;
  switch (action.type) {
    case 'toggle': {
      const [col, row] = action.key.split(',').map(Number);
      if (!(col >= 0 && col < GRID && row >= 0 && row < GRID)) return state;
      const marked = state.marked.includes(action.key) ? state.marked.filter((key) => key !== action.key) : [...state.marked, action.key];
      return { ...state, marked, feedback: null };
    }
    case 'check': {
      const feedback = check(state.challenge, state.marked);
      return { ...state, checks: state.checks + 1, feedback, done: feedback.solved };
    }
    case 'hint': {
      // Points at one changed cell's ROW that hasn't been found yet (not the cell itself).
      const next = state.challenge.changed.find((key) => !state.marked.includes(key) && !state.hints.includes(key));
      return next ? { ...state, hints: [...state.hints, next] } : state;
    }
    case 'restart':
      return startAttempt(state.challenge);
  }
}
export const assisted = (state: Attempt) => state.hints.length > 0;
export const hintRow = (key: string) => Number(key.split(',')[1]) + 1;

/** Each cell drawn in either version, row by row: the accessible list. */
export function cellRows(challenge: Challenge): { key: string; cell: Cell; original: Content | null; modified: Content | null }[] {
  const keys = [...new Set([...challenge.original, ...challenge.modified].map((mark) => cellKey(mark.cell)))];
  return keys
    .map((key) => {
      const [col, row] = key.split(',').map(Number);
      const cell = { col, row };
      const original = at(challenge.original, cell);
      const modified = at(challenge.modified, cell);
      return { key, cell, original: original && { motifId: original.motifId, color: original.color }, modified: modified && { motifId: modified.motifId, color: modified.color } };
    })
    .sort((a, b) => a.cell.row - b.cell.row || a.cell.col - b.cell.col);
}

/** Either pattern as a NEW unsaved Creator design (deep copy, real colours). */
export function toCreatorCopy(grid: readonly DetectiveMark[]): OymoEditorState {
  const layers: MotifLayer[] = grid.map((mark, index) => ({ id: `layer-${index}`, motifId: mark.motifId, color: DETECTIVE_COLORS[mark.color] ?? DETECTIVE_COLORS[BASE_COLOR], point: centre(mark.cell), rotation: 0, scale: 1, visible: true }));
  return JSON.parse(JSON.stringify({ layers, backgroundColor: '#EADCC0', nextId: layers.length })) as OymoEditorState;
}

/** Marks for the shared ResultGrid (with their colours). */
export const toMarks = (grid: readonly DetectiveMark[]) => grid.map((mark) => ({ cell: mark.cell, motifId: mark.motifId, source: true, color: DETECTIVE_COLORS[mark.color] }));
