import { CANVAS_SIZE } from '@/features/culture/oymo/components/OymoCanvas';
import { MAX_OYMO_LAYERS, MAX_SCALE, MIN_SCALE, type MotifLayer, type OymoEditorState } from '@/services/culture/oymoEditor';

/**
 * Border Workshop - pure rules. The user arranges motifs in ONE tile (a
 * 3 x 3 grid of cells) and repeats it along a horizontal strip, a vertical
 * strip, or a square frame. Every coordinate is computed here, in the Oymo
 * canvas's own 300 x 300 units, deterministically; the preview renders
 * exactly these layers and the Creator receives exactly these layers.
 *
 * The result is the user's own creation: no traditional name or meaning
 * is given to it.
 */
export const TILE_CELLS = 3;
export const TILE_SIZES = [60, 75, 90, 105, 120] as const;
export type TileSize = (typeof TILE_SIZES)[number];
export const SPACING_STEP = 5;
export const SPACING_MAX = 40;
/** Negative spacing = tiles overlap (allowed, explained). Down to half a tile. */
export const spacingMin = (tileSize: number) => -Math.floor(tileSize / 2 / SPACING_STEP) * SPACING_STEP;
export const MAX_PIECES = TILE_CELLS * TILE_CELLS;
/** Shape box on the canvas (OymoArtwork / OymoCanvas draw motifs 36 pt at scale 1). */
const SHAPE = 36;

export type Layout = 'horizontal' | 'vertical' | 'frame';
export const LAYOUTS: Layout[] = ['horizontal', 'vertical', 'frame'];

export type TilePiece = { id: string; motifId: string; color: string; col: number; row: number; rotation: number };
export type Tile = { size: TileSize; pieces: TilePiece[]; nextId: number };
export type Repeat = { layout: Layout; count: number; spacing: number };
export const EMPTY_TILE: Tile = { size: 90, pieces: [], nextId: 0 };
export const DEFAULT_REPEAT: Repeat = { layout: 'horizontal', count: 3, spacing: 0 };

/* ---------- the tile (editing never touches anything saved) ---------- */

const inTile = (col: number, row: number) => Number.isInteger(col) && Number.isInteger(row) && col >= 0 && row >= 0 && col < TILE_CELLS && row < TILE_CELLS;
export const pieceAt = (tile: Tile, col: number, row: number) => tile.pieces.find((piece) => piece.col === col && piece.row === row) ?? null;

export function placePiece(tile: Tile, col: number, row: number, motifId: string, color: string): Tile {
  if (!inTile(col, row) || pieceAt(tile, col, row)) return tile;
  return { ...tile, pieces: [...tile.pieces, { id: `t${tile.nextId}`, motifId, color, col, row, rotation: 0 }], nextId: tile.nextId + 1 };
}
export const removePiece = (tile: Tile, id: string): Tile => ({ ...tile, pieces: tile.pieces.filter((piece) => piece.id !== id) });
/** The Creator's rotation step semantics (degrees, wrapped to 0..359), in 45 degree steps here. */
export const rotatePiece = (tile: Tile, id: string, delta = 45): Tile => ({ ...tile, pieces: tile.pieces.map((piece) => (piece.id === id ? { ...piece, rotation: (piece.rotation + delta + 360) % 360 } : piece)) });
export const recolorPiece = (tile: Tile, id: string, color: string): Tile => ({ ...tile, pieces: tile.pieces.map((piece) => (piece.id === id ? { ...piece, color } : piece)) });
export const resizeTile = (tile: Tile, size: TileSize): Tile => ({ ...tile, size });
export const copyTile = (tile: Tile): Tile => ({ size: tile.size, nextId: tile.nextId, pieces: tile.pieces.map((piece) => ({ ...piece })) });

/* ---------- repetition ---------- */

/** Length of n tiles in a row with this spacing. */
const run = (count: number, tile: number, spacing: number) => count * tile + (count - 1) * spacing;
/** Tile ORIGINS (top-left) placed in a run of `count`, centred on the canvas. */
const along = (count: number, tile: number, spacing: number) => {
  const start = (CANVAS_SIZE - run(count, tile, spacing)) / 2;
  return Array.from({ length: count }, (_, index) => start + index * (tile + spacing));
};
const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Where each copy of the tile goes. A frame has `count` tiles per side;
 * its four corner tiles are shared by two sides and appear ONCE (4n - 4
 * tiles, or 1 when n = 1).
 */
export function tileOrigins(repeat: Repeat, tileSize: number): { x: number; y: number }[] {
  const positions = along(repeat.count, tileSize, repeat.spacing);
  const middle = (CANVAS_SIZE - tileSize) / 2;
  if (repeat.layout === 'horizontal') return positions.map((x) => ({ x: round(x), y: round(middle) }));
  if (repeat.layout === 'vertical') return positions.map((y) => ({ x: round(middle), y: round(y) }));
  const first = positions[0];
  const last = positions[positions.length - 1];
  const seen = new Set<string>();
  const out: { x: number; y: number }[] = [];
  const add = (x: number, y: number) => {
    const key = `${round(x)},${round(y)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ x: round(x), y: round(y) });
  };
  for (const x of positions) add(x, first); // top (with both corners)
  for (const y of positions) add(last, y); // right
  for (const x of [...positions].reverse()) add(x, last); // bottom
  for (const y of [...positions].reverse()) add(first, y); // left
  return out;
}

export const tileCount = (layout: Layout, count: number) => (layout === 'frame' ? (count <= 1 ? 1 : 4 * count - 4) : count);

/**
 * The largest repeat count that (a) fits on the canvas and (b) keeps the
 * design within the Creator's layer limit for this tile.
 */
export function maxCount(layout: Layout, tile: Tile, spacing: number): number {
  const pieces = Math.max(1, tile.pieces.length);
  let best = 1;
  for (let count = 1; count <= 40; count += 1) {
    const fits = run(count, tile.size, spacing) <= CANVAS_SIZE;
    const withinLimit = tileCount(layout, count) * pieces <= MAX_OYMO_LAYERS;
    if (fits && withinLimit) best = count;
    else break;
  }
  return best;
}
/** Keeps a repeat inside its safe limits (count, spacing range). */
export function clampRepeat(repeat: Repeat, tile: Tile): Repeat {
  const spacing = Math.max(spacingMin(tile.size), Math.min(SPACING_MAX, Math.round(repeat.spacing / SPACING_STEP) * SPACING_STEP));
  const count = Math.max(1, Math.min(maxCount(repeat.layout, tile, spacing), Math.round(repeat.count)));
  return { layout: repeat.layout, count, spacing };
}

/** Overlap between neighbouring tiles (positive = overlapping, in canvas units); 0 when they don't touch. */
export const overlapOf = (repeat: Repeat) => (repeat.count > 1 && repeat.spacing < 0 ? -repeat.spacing : 0);

/** The design: every tile copy as Creator layers (deterministic ids and order). */
export function buildBorder(tile: Tile, input: Repeat, background: string): { state: OymoEditorState; tiles: number; overlap: number; repeat: Repeat } {
  const repeat = clampRepeat(input, tile);
  const cell = tile.size / TILE_CELLS;
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, round((cell * 0.9) / SHAPE)));
  const origins = tileOrigins(repeat, tile.size);
  const layers: MotifLayer[] = [];
  const seen = new Set<string>();
  for (const origin of origins)
    for (const piece of [...tile.pieces].sort((a, b) => a.row - b.row || a.col - b.col)) {
      const point = { x: round(origin.x + (piece.col + 0.5) * cell), y: round(origin.y + (piece.row + 0.5) * cell) };
      // Two copies landing exactly on top of each other (only possible with overlap) are drawn once.
      const key = `${piece.motifId}|${piece.color}|${piece.rotation}|${point.x},${point.y}`;
      if (seen.has(key) || layers.length >= MAX_OYMO_LAYERS) continue;
      seen.add(key);
      layers.push({ id: `layer${layers.length}`, motifId: piece.motifId, color: piece.color, point, rotation: piece.rotation, scale, visible: true });
    }
  return { state: { layers, backgroundColor: background, nextId: layers.length }, tiles: origins.length, overlap: overlapOf(repeat), repeat };
}

/** For the readable summary: the tile's pieces row by row. */
export const describeTile = (tile: Tile) => [...tile.pieces].sort((a, b) => a.row - b.row || a.col - b.col);

/* ---------- the tile in progress (memory, owner-bound) ---------- */

let kept: { owner: string; tile: Tile; repeat: Repeat } | null = null;
export const keepWorkshop = (owner: string, tile: Tile, repeat: Repeat) => {
  kept = { owner, tile: copyTile(tile), repeat: { ...repeat } };
};
export const resumeWorkshop = (owner: string) => (kept && kept.owner === owner ? { tile: copyTile(kept.tile), repeat: { ...kept.repeat } } : null);
