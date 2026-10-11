/** Border Workshop: deterministic coordinates, bounds, frame corners, overlap, and an independent Creator copy. */
import { CANVAS_SIZE } from '@/features/culture/oymo/components/OymoCanvas';
import { addLayer, duplicateLayer, MAX_OYMO_LAYERS, type OymoEditorState } from '@/services/culture/oymoEditor';
import { handOffToCreator, takeCreatorHandoff } from '@/services/culture/oymoHandoff';

import { buildBorder, clampRepeat, copyTile, EMPTY_TILE, maxCount, placePiece, recolorPiece, rotatePiece, SPACING_MAX, spacingMin, tileCount, tileOrigins, type Repeat, type Tile } from './borderModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const tileOf = (cells: [number, number][], size: Tile['size'] = 60): Tile => cells.reduce((tile, [col, row]) => placePiece(tile, col, row, 'gul', '#2F5233'), { ...EMPTY_TILE, size });
const repeat = (layout: Repeat['layout'], count: number, spacing = 0): Repeat => ({ layout, count, spacing });

describe('coordinates', () => {
  it('a horizontal strip: centred, evenly spaced, deterministic', () => {
    const origins = tileOrigins(repeat('horizontal', 3, 10), 60);
    expect(origins).toEqual([{ x: 50, y: 120 }, { x: 120, y: 120 }, { x: 190, y: 120 }]);
    expect(tileOrigins(repeat('horizontal', 3, 10), 60)).toEqual(origins);
    const built = buildBorder(tileOf([[1, 1]]), repeat('horizontal', 3, 10), '#EADCC0');
    expect(built.state.layers.map((layer) => layer.point)).toEqual([{ x: 80, y: 150 }, { x: 150, y: 150 }, { x: 220, y: 150 }]);
  });

  it('a vertical strip mirrors the horizontal one', () => {
    expect(tileOrigins(repeat('vertical', 3, 10), 60)).toEqual([{ x: 120, y: 50 }, { x: 120, y: 120 }, { x: 120, y: 190 }]);
  });

  it('everything stays on the canvas', () => {
    for (const layout of ['horizontal', 'vertical', 'frame'] as const)
      for (const size of [60, 90, 120] as const) {
        const tile = tileOf([[0, 0], [2, 2]], size);
        const safe = clampRepeat(repeat(layout, 99, 0), tile);
        for (const point of buildBorder(tile, safe, '#fff').state.layers.map((layer) => layer.point)) {
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.x).toBeLessThanOrEqual(CANVAS_SIZE);
          expect(point.y).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeLessThanOrEqual(CANVAS_SIZE);
        }
      }
  });
});

describe('frame corners', () => {
  it.each([1, 2, 3, 4, 5])('%i per side: 4n-4 distinct tiles, corners once', (count) => {
    const origins = tileOrigins(repeat('frame', count, 0), 60);
    expect(origins).toHaveLength(tileCount('frame', count));
    expect(new Set(origins.map((origin) => `${origin.x},${origin.y}`)).size).toBe(origins.length);
  });
  it('no duplicate layers at the corners', () => {
    const built = buildBorder(tileOf([[0, 0], [1, 1], [2, 2]]), repeat('frame', 4, 0), '#fff');
    const keys = built.state.layers.map((layer) => `${layer.point.x},${layer.point.y}|${layer.motifId}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(built.tiles).toBe(12);
    expect(built.state.layers).toHaveLength(36);
  });
});

describe('bounds', () => {
  it('the repeat count is capped by the canvas and by the Creator layer limit', () => {
    expect(maxCount('horizontal', tileOf([[1, 1]], 60), 0)).toBe(5); // 5 x 60 = 300
    expect(maxCount('horizontal', tileOf([[1, 1]], 60), 10)).toBe(4);
    const full = tileOf([[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]], 60);
    expect(tileCount('frame', maxCount('frame', full, spacingMin(60))) * 9).toBeLessThanOrEqual(MAX_OYMO_LAYERS);
    const safe = clampRepeat(repeat('frame', 99, -999), full);
    expect(safe.spacing).toBe(spacingMin(60));
    expect(buildBorder(full, safe, '#fff').state.layers.length).toBeLessThanOrEqual(MAX_OYMO_LAYERS);
    expect(clampRepeat(repeat('horizontal', 0, 999), full)).toMatchObject({ count: 1, spacing: SPACING_MAX });
  });

  it('the Creator itself now enforces the same limit', () => {
    let state: OymoEditorState = { layers: [], backgroundColor: '#fff', nextId: 0 };
    for (let index = 0; index < MAX_OYMO_LAYERS + 5; index += 1) state = addLayer(state, { x: 10, y: 10 }, 'gul', '#000');
    expect(state.layers).toHaveLength(MAX_OYMO_LAYERS);
    expect(duplicateLayer(state, state.layers[0].id)).toBe(state);
  });

  it('negative spacing overlaps (explained, allowed); exact duplicates are drawn once', () => {
    const built = buildBorder(tileOf([[1, 1]], 60), repeat('horizontal', 3, -20), '#fff');
    expect(built.overlap).toBe(20);
    expect(buildBorder(tileOf([[1, 1]], 60), repeat('horizontal', 3, 0), '#fff').overlap).toBe(0);
  });
});

describe('the tile and the copy', () => {
  it('changing the repetition never changes the tile; edits make new tiles', () => {
    const tile = tileOf([[0, 0], [2, 1]]);
    const before = JSON.stringify(tile);
    for (const layout of ['horizontal', 'vertical', 'frame'] as const) buildBorder(tile, repeat(layout, 3, -10), '#fff');
    expect(JSON.stringify(tile)).toBe(before);
    const rotated = rotatePiece(tile, tile.pieces[0].id);
    expect(rotated.pieces[0].rotation).toBe(45);
    expect(tile.pieces[0].rotation).toBe(0);
    expect(recolorPiece(tile, tile.pieces[0].id, '#B9622F').pieces[0].color).toBe('#B9622F');
    expect(copyTile(tile)).not.toBe(tile);
  });

  it('the preview layers are exactly the handed-off design, and the copy is independent', () => {
    const tile = tileOf([[0, 0], [1, 2]]);
    const built = buildBorder(tile, repeat('frame', 3, 5), '#EADCC0');
    const preview = JSON.parse(JSON.stringify(built.state));
    handOffToCreator(built.state, { source: 'border' });
    const handed = takeCreatorHandoff()!;
    expect(handed.state).toEqual(preview);
    expect(handed.symmetry).toBe('none');
    handed.state.layers[0].point.x = -1;
    expect(built.state.layers[0].point.x).not.toBe(-1);
    expect(handed.state.nextId).toBe(handed.state.layers.length);
  });
});
