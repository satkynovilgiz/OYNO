import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { addLayer, EMPTY_OYMO_STATE, getLayerRenderPoints, moveLayerBy, moveLayerTo } from '@/services/culture/oymoEditor';

import { STEP_LABELS } from '../recipe/recipeModel';
import {
  artworkToScreen,
  clampArtworkPoint,
  clampViewport,
  handleSize,
  hitLayer,
  IDENTITY,
  MAX_ZOOM,
  PAN_THRESHOLD,
  panBy,
  screenToArtwork,
  TAP_SLOP,
  zoomIn,
  zoomOut,
  zoomTo,
  type Viewport,
} from './canvasViewport';

const SIZE = 300;
const close = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 6);
  expect(a.y).toBeCloseTo(b.y, 6);
};
const VIEWPORTS: Viewport[] = [IDENTITY, { zoom: 1.5, panX: 40, panY: -30 }, { zoom: 2, panX: -150, panY: 150 }, { zoom: 3, panX: 120, panY: -300 }, zoomTo(IDENTITY, 2.4, SIZE, { x: 10, y: 290 })];

describe('viewport transform - artwork coordinates never depend on the view', () => {
  it('screen <-> artwork round-trips exactly at every zoom/pan', () => {
    for (const viewport of VIEWPORTS.map((v) => clampViewport(v, SIZE))) {
      for (const point of [{ x: 0, y: 0 }, { x: 150, y: 150 }, { x: 37, y: 260 }, { x: 300, y: 300 }]) {
        close(screenToArtwork(artworkToScreen(point, viewport, SIZE), viewport, SIZE), point);
      }
    }
  });

  it('the same artwork point is reached by a tap at its on-screen position, whatever the zoom/pan', () => {
    const target = { x: 212, y: 64 };
    for (const viewport of VIEWPORTS.map((v) => clampViewport(v, SIZE))) {
      const tapAt = artworkToScreen(target, viewport, SIZE);
      close(screenToArtwork(tapAt, viewport, SIZE), target);
    }
    // Identity is the plain canvas: screen == artwork.
    close(screenToArtwork({ x: 12, y: 280 }, IDENTITY, SIZE), { x: 12, y: 280 });
  });

  it('zooming keeps the point under the focus (centre by default) in place', () => {
    const focus = { x: 80, y: 220 };
    const before = { zoom: 1.5, panX: 20, panY: -10 };
    const anchor = screenToArtwork(focus, before, SIZE);
    const after = zoomTo(before, 2, SIZE, focus);
    close(artworkToScreen(anchor, after, SIZE), focus);
    const centre = screenToArtwork({ x: 150, y: 150 }, IDENTITY, SIZE);
    close(screenToArtwork({ x: 150, y: 150 }, zoomIn(IDENTITY, SIZE), SIZE), centre);
  });

  it('zoom steps, limits and reset', () => {
    expect(zoomIn(IDENTITY, SIZE).zoom).toBe(1.5);
    expect(zoomIn(zoomIn(IDENTITY, SIZE), SIZE).zoom).toBe(2);
    expect(zoomIn({ zoom: MAX_ZOOM, panX: 0, panY: 0 }, SIZE).zoom).toBe(MAX_ZOOM);
    expect(zoomOut({ zoom: 2, panX: 100, panY: 100 }, SIZE).zoom).toBe(1.5);
    // Back at 1x the artwork exactly fills the frame again.
    expect(zoomOut({ zoom: 1.5, panX: 60, panY: -60 }, SIZE)).toEqual(IDENTITY);
  });

  it('pan is clamped so the artwork always covers the frame', () => {
    expect(panBy(IDENTITY, 80, -80, SIZE)).toEqual(IDENTITY);
    const zoomed = { zoom: 2, panX: 0, panY: 0 };
    expect(panBy(zoomed, 1000, -1000, SIZE)).toEqual({ zoom: 2, panX: 150, panY: -150 });
    // The frame corners still map inside the artwork at the clamp.
    const edge = panBy(zoomed, 1000, -1000, SIZE);
    for (const corner of [{ x: 0, y: 0 }, { x: SIZE, y: SIZE }]) {
      const at = screenToArtwork(corner, edge, SIZE);
      expect(at.x).toBeGreaterThanOrEqual(-1e-9);
      expect(at.y).toBeLessThanOrEqual(SIZE + 1e-9);
    }
  });
});

describe('placing, panning and selecting', () => {
  it('a pan can never be a tap: the tap fails before the pan can start', () => {
    expect(TAP_SLOP).toBeLessThan(PAN_THRESHOLD);
    const canvas = fs.readFileSync(path.join(__dirname, '../components/OymoCanvas.tsx'), 'utf8');
    expect(canvas).toMatch(/Gesture\.Race\(Gesture\.Simultaneous\(pinch, pan\), tap\)/);
    expect(canvas).toMatch(/\.maxDistance\(TAP_SLOP\)/);
    expect(canvas).toMatch(/\.minDistance\(PAN_THRESHOLD\)/);
  });

  it('a tap on a drawn motif (any mirrored copy) selects the topmost layer instead of placing', () => {
    let state = addLayer(EMPTY_OYMO_STATE, { x: 60, y: 60 }, 'kochkorMuyuz', '#000000');
    state = addLayer(state, { x: 64, y: 62 }, 'ram', '#000000');
    const layers = state.layers.map((layer) => ({ ...layer, points: getLayerRenderPoints(layer, 'fourWay', SIZE) }));
    expect(hitLayer(layers, { x: 62, y: 61 }, 18)).toBe('layer1');
    // The mirrored copy on the other side selects the same layer.
    expect(hitLayer(layers, { x: 300 - 62, y: 61 }, 18)).toBe('layer1');
    expect(hitLayer(layers, { x: 150, y: 150 }, 18)).toBeNull();
    expect(hitLayer(layers.map((layer) => ({ ...layer, visible: layer.id !== 'layer1' })), { x: 62, y: 61 }, 18)).toBe('layer0');
  });

  it('placement points are clamped to the artwork on the integer grid', () => {
    expect(clampArtworkPoint({ x: -4.2, y: 301.7 }, SIZE)).toEqual({ x: 0, y: 300 });
    expect(clampArtworkPoint({ x: 12.4, y: 12.6 }, SIZE)).toEqual({ x: 12, y: 13 });
  });

  it('handles stay readable: never below the touch minimum, and they grow with zoom', () => {
    expect(handleSize(36, 0.4, 1)).toBe(44);
    expect(handleSize(36, 1, 3)).toBeGreaterThan(handleSize(36, 1, 1.5));
  });
});

describe('numeric movement', () => {
  const base = addLayer(EMPTY_OYMO_STATE, { x: 100, y: 120 }, 'kochkorMuyuz', '#123456');

  it('numeric movement and a tap give the same coordinates', () => {
    const viewport = clampViewport({ zoom: 2, panX: -60, panY: 40 }, SIZE);
    const tapped = clampArtworkPoint(screenToArtwork(artworkToScreen({ x: 180, y: 75 }, viewport, SIZE), viewport, SIZE), SIZE);
    expect(moveLayerTo(base, 'layer0', { x: 180, y: 75 }, SIZE).layers[0].point).toEqual(tapped);
  });

  it('moves are clamped, keep everything else and the mirrors follow', () => {
    const custom = { ...base, layers: [{ ...base.layers[0], motifId: 'custom:m1', custom: { v: 1, name: 'Mine', primitives: [{ kind: 'line', from: [0, 0], to: [24, 24] }] }, rotation: 45, scale: 1.3 }] };
    const moved = moveLayerBy(custom, 'layer0', 10, -500, SIZE).layers[0];
    expect(moved.point).toEqual({ x: 110, y: 0 });
    expect({ ...moved, point: null }).toEqual({ ...custom.layers[0], point: null });
    expect(getLayerRenderPoints(moved, 'fourWay', SIZE)).toEqual(expect.arrayContaining([{ x: 190, y: 0 }]));
    expect(moveLayerBy(base, 'layer0', 0, 0, SIZE)).toBe(base);
    expect(moveLayerBy(base, 'nope', 5, 5, SIZE)).toBe(base);
  });

  it('a move is an undoable, replayable recipe step', () => {
    expect(STEP_LABELS).toContain('move');
    for (const dict of [en, ru, kg]) {
      const labels = (dict as unknown as { culture: { oymo: { recipe: { labels: Record<string, string> } } } }).culture.oymo.recipe.labels;
      for (const label of STEP_LABELS) expect([label, !!labels[label]]).toEqual([label, true]);
      const view = (dict as unknown as { canvasView: Record<string, string> }).canvasView;
      for (const key of ['zoomIn', 'zoomOut', 'reset', 'zoomLevel', 'position', 'xLabel', 'yLabel', 'moveLeft_one', 'moveLeft_other', 'stepValue_few']) expect([key, !!view[key]]).toEqual([key, true]);
    }
    const creator = fs.readFileSync(path.join(__dirname, '../OymoCreatorScreen.tsx'), 'utf8');
    expect(creator).toMatch(/label: 'move'/);
    // Session-only: the viewport is plain component state, reset with the design and never stored.
    expect(creator).toMatch(/useState<Viewport>\(IDENTITY\)/);
    expect(creator).not.toMatch(/AsyncStorage[^\n]*viewport/i);
  });
});
