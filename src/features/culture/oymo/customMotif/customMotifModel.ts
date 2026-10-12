import type { MotifPrimitive } from '../motifGeometry';

/**
 * User-created Oymo motifs - format `oyno.customMotif` VERSION 1.
 *
 *   { format: 'oyno.customMotif', v: 1, id: 'cm-…', name, primitives }
 *   primitive = { kind: 'line', x1, y1, x2, y2 }
 *             | { kind: 'circle', cx, cy, r }
 *             | { kind: 'polygon', points: [[x, y], …] }   (closed, 3-6 points)
 *
 * Coordinates are INTEGERS on the same 0..24 grid as the built-in motifs
 * (motifGeometry.ts); at most 16 primitives. A placed custom motif is
 * EMBEDDED in its layer (`motifId: 'custom:<id>'`, `custom: { v, name,
 * primitives }`), so saved designs, recipes, milestones, remixes and
 * exports carry their own geometry. Anything that doesn't validate renders
 * as a labelled placeholder - never as a substitute shape, never a crash.
 *
 * Custom motifs are labelled user-created and carry no traditional meaning.
 */
export const CUSTOM_FORMAT = 'oyno.customMotif';
export const CUSTOM_VERSION = 1;
export const GRID = 24;
export const MAX_PRIMITIVES = 16;
export const POLYGON_MIN = 3;
export const POLYGON_MAX = 6;
export const NAME_MAX = 30;
export const CUSTOM_PREFIX = 'custom:';

export type CustomPrimitive = { kind: 'line'; x1: number; y1: number; x2: number; y2: number } | { kind: 'circle'; cx: number; cy: number; r: number } | { kind: 'polygon'; points: [number, number][] };
export type CustomMotif = { format: typeof CUSTOM_FORMAT; v: typeof CUSTOM_VERSION; id: string; name: string; primitives: CustomPrimitive[]; updatedAt: string };
/** What a layer embeds. */
export type EmbeddedMotif = { v: typeof CUSTOM_VERSION; name: string; primitives: CustomPrimitive[] };

const onGrid = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= GRID;
export const snap = (n: number) => Math.min(GRID, Math.max(0, Math.round(n)));

export function validPrimitive(p: unknown): p is CustomPrimitive {
  if (!p || typeof p !== 'object') return false;
  const v = p as Record<string, unknown>;
  if (v.kind === 'line') return [v.x1, v.y1, v.x2, v.y2].every(onGrid) && !(v.x1 === v.x2 && v.y1 === v.y2);
  if (v.kind === 'circle') return onGrid(v.cx) && onGrid(v.cy) && Number.isInteger(v.r) && (v.r as number) >= 1 && (v.r as number) <= GRID / 2;
  if (v.kind === 'polygon') {
    const pts = v.points;
    if (!Array.isArray(pts) || pts.length < POLYGON_MIN || pts.length > POLYGON_MAX) return false;
    if (!pts.every((pt) => Array.isArray(pt) && pt.length === 2 && onGrid(pt[0]) && onGrid(pt[1]))) return false;
    return new Set(pts.map((pt) => `${pt[0]},${pt[1]}`)).size === pts.length;
  }
  return false;
}

export function validateEmbedded(raw: unknown): EmbeddedMotif | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Partial<EmbeddedMotif>;
  if (v.v !== CUSTOM_VERSION || !Array.isArray(v.primitives) || v.primitives.length === 0 || v.primitives.length > MAX_PRIMITIVES) return null;
  if (!v.primitives.every(validPrimitive)) return null;
  return { v: CUSTOM_VERSION, name: typeof v.name === 'string' ? v.name.slice(0, NAME_MAX) : '', primitives: v.primitives.map(copyPrimitive) };
}

export function validateMotif(raw: unknown): CustomMotif | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Partial<CustomMotif>;
  if (v.format !== CUSTOM_FORMAT || typeof v.id !== 'string' || !/^cm-[a-z0-9-]{4,40}$/.test(v.id)) return null;
  const embedded = validateEmbedded({ v: v.v, name: v.name, primitives: v.primitives });
  if (!embedded) return null;
  return { format: CUSTOM_FORMAT, v: CUSTOM_VERSION, id: v.id, name: embedded.name, primitives: embedded.primitives, updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : '' };
}

export const copyPrimitive = (p: CustomPrimitive): CustomPrimitive => (p.kind === 'polygon' ? { kind: 'polygon', points: p.points.map(([x, y]) => [x, y] as [number, number]) } : { ...p });

/** The deterministic geometry both the preview and the Creator draw (same primitive type as the built-ins). */
export function toGeometry(primitives: readonly CustomPrimitive[]): MotifPrimitive[] {
  return primitives.map((p): MotifPrimitive => {
    if (p.kind === 'line') return { kind: 'path', d: `M${p.x1} ${p.y1}L${p.x2} ${p.y2}`, strokeWidth: 2, cap: 'round', join: 'round' };
    if (p.kind === 'circle') return { kind: 'circle', cx: p.cx, cy: p.cy, r: p.r, strokeWidth: 2 };
    return { kind: 'path', d: `M${p.points.map(([x, y]) => `${x} ${y}`).join('L')}Z`, strokeWidth: 2, join: 'round' };
  });
}

/* ---------- editing (pure; every change is a new motif - undo keeps whole snapshots) ---------- */

export type EditAction = { type: 'add'; primitive: CustomPrimitive } | { type: 'remove'; index: number } | { type: 'move'; index: number; dx: number; dy: number } | { type: 'rename'; name: string };

/** Applies one edit; returns the SAME motif when the edit isn't allowed (bounds, limits, invalid). */
export function applyEdit(motif: CustomMotif, action: EditAction): CustomMotif {
  const primitives = motif.primitives.map(copyPrimitive);
  switch (action.type) {
    case 'add':
      if (primitives.length >= MAX_PRIMITIVES || !validPrimitive(action.primitive)) return motif;
      return { ...motif, primitives: [...primitives, copyPrimitive(action.primitive)] };
    case 'remove':
      if (action.index < 0 || action.index >= primitives.length) return motif;
      return { ...motif, primitives: primitives.filter((_, i) => i !== action.index) };
    case 'move': {
      const p = primitives[action.index];
      if (!p) return motif;
      const moved: CustomPrimitive = p.kind === 'line' ? { ...p, x1: p.x1 + action.dx, y1: p.y1 + action.dy, x2: p.x2 + action.dx, y2: p.y2 + action.dy } : p.kind === 'circle' ? { ...p, cx: p.cx + action.dx, cy: p.cy + action.dy } : { kind: 'polygon', points: p.points.map(([x, y]) => [x + action.dx, y + action.dy] as [number, number]) };
      if (!validPrimitive(moved)) return motif; // would leave the grid
      primitives[action.index] = moved;
      return { ...motif, primitives };
    }
    case 'rename': {
      const name = action.name.replace(/[<>{}]/g, '').slice(0, NAME_MAX);
      return name === motif.name ? motif : { ...motif, name };
    }
  }
}

export type History = { stack: CustomMotif[]; index: number };
export const startHistory = (motif: CustomMotif): History => ({ stack: [motif], index: 0 });
export const current = (h: History) => h.stack[h.index];
export function edit(h: History, action: EditAction): History {
  const next = applyEdit(current(h), action);
  if (next === current(h)) return h;
  const stack = [...h.stack.slice(0, h.index + 1), next];
  return { stack, index: stack.length - 1 };
}
export const undo = (h: History): History => (h.index > 0 ? { ...h, index: h.index - 1 } : h);
export const redo = (h: History): History => (h.index < h.stack.length - 1 ? { ...h, index: h.index + 1 } : h);

export const newMotif = (name = ''): CustomMotif => ({ format: CUSTOM_FORMAT, v: CUSTOM_VERSION, id: `cm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, name, primitives: [], updatedAt: '' });
export const embed = (motif: CustomMotif): EmbeddedMotif => ({ v: CUSTOM_VERSION, name: motif.name, primitives: motif.primitives.map(copyPrimitive) });
export const isCustomId = (motifId: string) => motifId.startsWith(CUSTOM_PREFIX);
