import {
  EMPTY_OYMO_STATE,
  addLayer,
  duplicateLayer,
  getLayerRenderPoints,
  removeLayer,
  reorderLayer,
  resetCanvas,
  rotateLayer,
  scaleLayer,
  setBackgroundColor,
  toggleLayerVisibility,
} from './oymoEditor';

const CANVAS_SIZE = 300;

describe('addLayer', () => {
  it('adds a layer with default rotation/scale/visibility', () => {
    const state = addLayer(EMPTY_OYMO_STATE, { x: 80, y: 120 }, 'muyuz', '#2F5233');
    expect(state.layers).toHaveLength(1);
    expect(state.layers[0]).toMatchObject({ motifId: 'muyuz', color: '#2F5233', rotation: 0, scale: 1, visible: true });
  });

  it('assigns unique, deterministic ids across multiple additions', () => {
    let state = addLayer(EMPTY_OYMO_STATE, { x: 10, y: 10 }, 'muyuz', '#000');
    state = addLayer(state, { x: 20, y: 20 }, 'gul', '#fff');
    expect(state.layers).toHaveLength(2);
    expect(new Set(state.layers.map((l) => l.id)).size).toBe(2);
  });
});

describe('removeLayer', () => {
  it('removes only the targeted layer', () => {
    let state = addLayer(EMPTY_OYMO_STATE, { x: 10, y: 10 }, 'muyuz', '#000');
    state = addLayer(state, { x: 20, y: 20 }, 'gul', '#fff');
    const idToRemove = state.layers[0].id;
    const next = removeLayer(state, idToRemove);
    expect(next.layers).toHaveLength(1);
    expect(next.layers.some((l) => l.id === idToRemove)).toBe(false);
  });
});

describe('duplicateLayer', () => {
  it('adds a copy offset from the source, keeping the source intact', () => {
    const placed = addLayer(EMPTY_OYMO_STATE, { x: 50, y: 50 }, 'muyuz', '#2F5233');
    const layerId = placed.layers[0].id;
    const next = duplicateLayer(placed, layerId);
    expect(next.layers).toHaveLength(2);
    const copy = next.layers[1];
    expect(copy.id).not.toBe(layerId);
    expect(copy.point).not.toEqual({ x: 50, y: 50 });
    expect(copy.motifId).toBe('muyuz');
  });

  it('is a no-op for an unknown layer id', () => {
    const state = addLayer(EMPTY_OYMO_STATE, { x: 50, y: 50 }, 'muyuz', '#2F5233');
    expect(duplicateLayer(state, 'nonexistent')).toEqual(state);
  });
});

describe('rotateLayer', () => {
  it('increments rotation by the default step and wraps at 360', () => {
    let state = addLayer(EMPTY_OYMO_STATE, { x: 50, y: 50 }, 'muyuz', '#000');
    const id = state.layers[0].id;
    state = rotateLayer(state, id);
    expect(state.layers[0].rotation).toBe(15);
    state = rotateLayer(state, id, 350);
    expect(state.layers[0].rotation).toBe(5);
  });
});

describe('scaleLayer', () => {
  it('increments scale by the default step and clamps to the valid range', () => {
    let state = addLayer(EMPTY_OYMO_STATE, { x: 50, y: 50 }, 'muyuz', '#000');
    const id = state.layers[0].id;
    state = scaleLayer(state, id);
    expect(state.layers[0].scale).toBeCloseTo(1.15);
    state = scaleLayer(state, id, -10);
    expect(state.layers[0].scale).toBe(0.4);
    state = scaleLayer(state, id, 10);
    expect(state.layers[0].scale).toBe(2.5);
  });
});

describe('reorderLayer', () => {
  it('swaps a layer with its neighbor and no-ops at the array edges', () => {
    let state = addLayer(EMPTY_OYMO_STATE, { x: 1, y: 1 }, 'a', '#000');
    state = addLayer(state, { x: 2, y: 2 }, 'b', '#000');
    state = addLayer(state, { x: 3, y: 3 }, 'c', '#000');
    const [firstId, secondId, thirdId] = state.layers.map((l) => l.id);

    const movedUp = reorderLayer(state, firstId, 'up');
    expect(movedUp.layers.map((l) => l.id)).toEqual([secondId, firstId, thirdId]);

    const noopAtTop = reorderLayer(state, thirdId, 'up');
    expect(noopAtTop.layers.map((l) => l.id)).toEqual([firstId, secondId, thirdId]);

    const noopAtBottom = reorderLayer(state, firstId, 'down');
    expect(noopAtBottom.layers.map((l) => l.id)).toEqual([firstId, secondId, thirdId]);
  });
});

describe('toggleLayerVisibility', () => {
  it('flips visibility for only the targeted layer', () => {
    const state = addLayer(EMPTY_OYMO_STATE, { x: 1, y: 1 }, 'a', '#000');
    const id = state.layers[0].id;
    const hidden = toggleLayerVisibility(state, id);
    expect(hidden.layers[0].visible).toBe(false);
    const shown = toggleLayerVisibility(hidden, id);
    expect(shown.layers[0].visible).toBe(true);
  });
});

describe('setBackgroundColor', () => {
  it('updates only the background color', () => {
    const state = setBackgroundColor(EMPTY_OYMO_STATE, '#123456');
    expect(state.backgroundColor).toBe('#123456');
    expect(state.layers).toEqual([]);
  });
});

describe('resetCanvas', () => {
  it('returns an empty state', () => {
    const placed = addLayer(EMPTY_OYMO_STATE, { x: 10, y: 10 }, 'muyuz', '#000');
    expect(resetCanvas()).toEqual(EMPTY_OYMO_STATE);
    expect(placed.layers.length).toBeGreaterThan(0);
  });
});

describe('getLayerRenderPoints', () => {
  it('recomputes mirrored points from the current symmetry mode, not a baked-in value', () => {
    const state = addLayer(EMPTY_OYMO_STATE, { x: 80, y: 120 }, 'muyuz', '#000');
    const layer = state.layers[0];

    expect(getLayerRenderPoints(layer, 'none', CANVAS_SIZE)).toHaveLength(1);
    expect(getLayerRenderPoints(layer, 'mirror', CANVAS_SIZE)).toHaveLength(2);
    expect(getLayerRenderPoints(layer, 'fourWay', CANVAS_SIZE)).toHaveLength(4);
  });
});
