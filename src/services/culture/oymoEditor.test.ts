import {
  EMPTY_OYMO_STATE,
  computeMirroredPoints,
  placeMotif,
  removeMotif,
  resetCanvas,
} from './oymoEditor';

const CANVAS_SIZE = 300;

describe('computeMirroredPoints', () => {
  it('returns just the tapped point when symmetry is none', () => {
    expect(computeMirroredPoints({ x: 80, y: 120 }, 'none', CANVAS_SIZE)).toEqual([{ x: 80, y: 120 }]);
  });

  it('mirrors across the vertical axis', () => {
    const points = computeMirroredPoints({ x: 80, y: 120 }, 'mirror', CANVAS_SIZE);
    expect(points).toEqual(
      expect.arrayContaining([{ x: 80, y: 120 }, { x: 220, y: 120 }]),
    );
    expect(points).toHaveLength(2);
  });

  it('reflects into all 4 quadrants for fourWay', () => {
    const points = computeMirroredPoints({ x: 80, y: 120 }, 'fourWay', CANVAS_SIZE);
    expect(points).toEqual(
      expect.arrayContaining([
        { x: 80, y: 120 },
        { x: 220, y: 120 },
        { x: 80, y: 180 },
        { x: 220, y: 180 },
      ]),
    );
    expect(points).toHaveLength(4);
  });

  it('collapses to a single point at dead center for fourWay (no duplicate stacking)', () => {
    const center = CANVAS_SIZE / 2;
    const points = computeMirroredPoints({ x: center, y: center }, 'fourWay', CANVAS_SIZE);
    expect(points).toEqual([{ x: center, y: center }]);
  });

  it('collapses to a single point on the vertical center line for mirror', () => {
    const center = CANVAS_SIZE / 2;
    const points = computeMirroredPoints({ x: center, y: 50 }, 'mirror', CANVAS_SIZE);
    expect(points).toEqual([{ x: center, y: 50 }]);
  });
});

describe('placeMotif', () => {
  it('adds one placement per mirrored point with unique, deterministic ids', () => {
    const state = placeMotif(EMPTY_OYMO_STATE, { x: 80, y: 120 }, 'muyuz', '#2F5233', 'fourWay', CANVAS_SIZE);
    expect(state.placements).toHaveLength(4);
    expect(new Set(state.placements.map((p) => p.id)).size).toBe(4);
    expect(state.placements.every((p) => p.motifId === 'muyuz' && p.color === '#2F5233')).toBe(true);
    expect(state.nextId).toBe(4);
  });

  it('accumulates across multiple placements without id collisions', () => {
    let state = placeMotif(EMPTY_OYMO_STATE, { x: 10, y: 10 }, 'muyuz', '#000', 'none', CANVAS_SIZE);
    state = placeMotif(state, { x: 20, y: 20 }, 'gul', '#fff', 'none', CANVAS_SIZE);
    expect(state.placements).toHaveLength(2);
    expect(state.placements[0].id).not.toBe(state.placements[1].id);
  });
});

describe('removeMotif', () => {
  it('removes only the targeted placement', () => {
    const placed = placeMotif(EMPTY_OYMO_STATE, { x: 10, y: 10 }, 'muyuz', '#000', 'mirror', CANVAS_SIZE);
    const idToRemove = placed.placements[0].id;
    const next = removeMotif(placed, idToRemove);
    expect(next.placements).toHaveLength(1);
    expect(next.placements.some((p) => p.id === idToRemove)).toBe(false);
  });
});

describe('resetCanvas', () => {
  it('returns an empty state', () => {
    const placed = placeMotif(EMPTY_OYMO_STATE, { x: 10, y: 10 }, 'muyuz', '#000', 'fourWay', CANVAS_SIZE);
    expect(resetCanvas()).toEqual(EMPTY_OYMO_STATE);
    expect(placed.placements.length).toBeGreaterThan(0);
  });
});
