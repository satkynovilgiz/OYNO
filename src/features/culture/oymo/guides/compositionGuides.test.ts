import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { addLayer, EMPTY_OYMO_STATE, getLayerRenderPoints, moveLayerTo } from '@/services/culture/oymoEditor';

import { artworkToScreen, clampViewport, screenToArtwork, ZOOM_STEPS, type Viewport } from '../canvas/canvasViewport';

import { anyGuideShown, DEFAULT_GUIDES, dragPoint, GRID_SPACINGS, guideLines, placePoint, reflect, reflectionFor, SAFE_MARGIN, SNAP_DISTANCE, snapActive, snapAxis, startDrag, type GuideSettings } from './compositionGuides';

const SIZE = 300;
const ALL: GuideSettings = { grid: true, axes: true, margins: true, spacing: 25, snap: true };
const only = (patch: Partial<GuideSettings>): GuideSettings => ({ ...DEFAULT_GUIDES, ...patch });

describe('guides and settings', () => {
  it('a small set of spacings, all dividing the canvas (so the grid is symmetric about the centre)', () => {
    expect(GRID_SPACINGS).toEqual([10, 25, 50]);
    for (const spacing of GRID_SPACINGS) {
      expect(SIZE % spacing).toBe(0);
      const values = guideLines(only({ grid: true, spacing }), SIZE).map((line) => line.value);
      expect(values).toEqual(values.map((value) => SIZE - value).reverse());
      expect(values[0]).toBe(spacing);
      expect(values[values.length - 1]).toBe(SIZE - spacing);
    }
    expect(guideLines(only({ margins: true }), SIZE).map((line) => line.value)).toEqual([SAFE_MARGIN, SIZE - SAFE_MARGIN]);
    expect(guideLines(only({ axes: true }), SIZE)).toEqual([{ value: 150, kind: 'axis' }]);
  });

  it('defaults: no guides shown, so nothing snaps until a guide is turned on', () => {
    expect(anyGuideShown(DEFAULT_GUIDES)).toBe(false);
    expect(snapActive(DEFAULT_GUIDES)).toBe(false);
    expect(placePoint({ x: 148.6, y: 3.2 }, DEFAULT_GUIDES, SIZE)).toEqual({ point: { x: 149, y: 3 }, x: null, y: null });
    expect(snapActive(only({ axes: true }))).toBe(true);
    expect(snapActive(only({ axes: true, snap: false }))).toBe(false);
    expect(snapActive(only({ axes: true }), true)).toBe(false); // free placement held
  });
});

describe('snapping boundaries (artwork units)', () => {
  const lines = guideLines(only({ axes: true }), SIZE);
  it('snaps within SNAP_DISTANCE inclusive, not beyond', () => {
    expect(snapAxis(150 + SNAP_DISTANCE, lines)).toEqual({ value: 150, kind: 'axis' });
    expect(snapAxis(150 - SNAP_DISTANCE, lines)).toEqual({ value: 150, kind: 'axis' });
    expect(snapAxis(150 + SNAP_DISTANCE + 0.01, lines)).toEqual({ value: 150 + SNAP_DISTANCE + 0.01, kind: null });
    expect(snapAxis(150, lines)).toEqual({ value: 150, kind: 'axis' });
  });

  it('nearest line wins; a tie prefers the centre axis, then the margin, then the grid', () => {
    const grid10 = guideLines({ ...ALL, spacing: 10 }, SIZE);
    // 33 is 3 from the margin (30) and 3 from... no grid line at 36 with spacing 10 -> nearest is 30 (margin AND grid).
    expect(snapAxis(33, grid10)).toEqual({ value: 30, kind: 'margin' });
    // 150 is axis and grid: reported as the axis.
    expect(snapAxis(151, grid10)).toEqual({ value: 150, kind: 'axis' });
    // 145 is exactly between grid 140 and axis/grid 150: the tie goes to the axis.
    expect(snapAxis(145, grid10)).toEqual({ value: 150, kind: 'axis' });
    // Exactly between two grid lines: the first found (lower) - deterministic.
    expect(snapAxis(62.5, guideLines(only({ grid: true, spacing: 25 }), SIZE))).toEqual({ value: 62.5, kind: null });
    expect(snapAxis(55, guideLines(only({ grid: true, spacing: 10 }), SIZE))).toEqual({ value: 50, kind: 'grid' });
  });

  it('x and y snap independently; the result is on the integer grid and inside the artwork', () => {
    const result = placePoint({ x: 147.2, y: 88.9 }, only({ axes: true }), SIZE);
    expect(result).toEqual({ point: { x: 150, y: 89 }, x: 'axis', y: null });
    expect(placePoint({ x: -20, y: 400 }, only({ grid: true, spacing: 50 }), SIZE).point).toEqual({ x: 0, y: 300 });
  });
});

describe('zoom / pan independence', () => {
  const VIEWPORTS: Viewport[] = [
    { zoom: 1, panX: 0, panY: 0 },
    ...ZOOM_STEPS.slice(1).flatMap((zoom) => [
      { zoom, panX: 0, panY: 0 },
      { zoom, panX: 60, panY: -45 },
    ]),
  ].map((v) => clampViewport(v, SIZE));

  it('the same artwork position snaps identically at every zoom level and pan', () => {
    for (const target of [
      { x: 146.5, y: 31.2 },
      { x: 74, y: 228.4 },
      { x: 156, y: 156 },
      { x: 12.3, y: 293.9 },
    ]) {
      const results = VIEWPORTS.map((viewport) => placePoint(screenToArtwork(artworkToScreen(target, viewport, SIZE), viewport, SIZE), ALL, SIZE));
      for (const result of results) expect(result).toEqual(results[0]);
    }
  });

  it('a drag lands on the same snapped point whatever the zoom', () => {
    const layer = addLayer(EMPTY_OYMO_STATE, { x: 100, y: 100 }, 'gul', '#2F5233').layers[0];
    const finger = { x: 147, y: 52 };
    const points = VIEWPORTS.map((viewport) => {
      const down = artworkToScreen({ x: 102, y: 98 }, viewport, SIZE);
      const drag = startDrag(layer.id, layer.point, screenToArtwork(down, viewport, SIZE), 'none', SIZE);
      return dragPoint(drag, screenToArtwork(artworkToScreen({ x: finger.x + 2, y: finger.y - 2 }, viewport, SIZE), viewport, SIZE), ALL, SIZE).point;
    });
    for (const point of points) expect(point).toEqual({ x: 150, y: 50 });
  });
});

describe('symmetry and custom motifs', () => {
  it('dragging a mirrored copy moves the layer by the mirrored movement; the copy snaps to the mirrored guide', () => {
    const layer = { ...addLayer(EMPTY_OYMO_STATE, { x: 80, y: 60 }, 'gul', '#2F5233').layers[0] };
    // The fourWay copy at (220, 240) is grabbed and dragged to near (227, 270 - margin).
    const grabbed = { x: 220, y: 240 };
    const drag = startDrag(layer.id, layer.point, grabbed, 'fourWay', SIZE);
    expect(drag.reflection).toEqual({ flipX: true, flipY: true });
    const result = dragPoint(drag, { x: 224, y: 268 }, only({ margins: true, grid: true, spacing: 50 }), SIZE);
    // The layer's own point mirrors the copy: (300-224, 300-268) = (76, 32) -> snapped y to the margin (30).
    expect(result.point).toEqual({ x: 76, y: 30 });
    expect(result.y).toBe('margin');
    const copies = getLayerRenderPoints({ ...layer, point: result.point }, 'fourWay', SIZE);
    expect(copies).toContainEqual({ x: 224, y: 270 }); // the grabbed copy sits on the mirrored margin line
  });

  it('snapping a point or its mirror image gives mirror-image results (guides are symmetric)', () => {
    for (const mode of ['mirror', 'fourWay'] as const) {
      for (const r of reflectionFor(mode)) {
        for (const point of [
          { x: 33, y: 147 },
          { x: 102, y: 271 },
          { x: 148, y: 152 },
        ]) {
          const direct = placePoint(point, ALL, SIZE).point;
          const viaMirror = reflect(placePoint(reflect(point, r, SIZE), ALL, SIZE).point, r, SIZE);
          expect(viaMirror).toEqual(direct);
        }
      }
    }
  });

  it('a committed move keeps custom geometry, rotation, scale and colour', () => {
    const custom = { v: 1, name: 'Synthetic', primitives: [{ kind: 'circle', cx: 12, cy: 12, r: 4 }] };
    const state = { ...EMPTY_OYMO_STATE, layers: [{ id: 'l1', motifId: 'custom:cm-synthetic', color: '#7A3226', point: { x: 90, y: 90 }, rotation: 45, scale: 1.3, visible: true, custom }], nextId: 1 };
    const drag = startDrag('l1', { x: 90, y: 90 }, { x: 90, y: 90 }, 'none', SIZE);
    const moved = moveLayerTo(state, 'l1', dragPoint(drag, { x: 148, y: 91 }, only({ axes: true }), SIZE).point, SIZE).layers[0];
    expect(moved).toEqual({ ...state.layers[0], point: { x: 150, y: 91 } });
    expect(moved.custom).toBe(custom);
  });
});

describe('separation from the artwork, history and export', () => {
  const read = (relative: string) => fs.readFileSync(path.join(__dirname, relative), 'utf8');

  it('guide settings are view state: the guides model has no layer-mutating code and layers never mention guides', () => {
    const model = read('compositionGuides.ts');
    expect(model).not.toMatch(/oymoEditor/);
    const editor = read('../../../../services/culture/oymoEditor.ts');
    const layerType = editor.slice(editor.indexOf('export type MotifLayer'), editor.indexOf('export type OymoEditorState'));
    expect(layerType).not.toMatch(/guide|snap|grid|preview/i);
    // Creator: guide toggles are useState, not history entries.
    const creator = read('../OymoCreatorScreen.tsx');
    expect(creator).toMatch(/useState<GuideSettings>\(DEFAULT_GUIDES\)/);
    expect(creator).toMatch(/<GuideControls settings=\{guides\} onChange=\{setGuides\}/);
  });

  it('a drag commits once, as its own Undo / recipe step', () => {
    const creator = read('../OymoCreatorScreen.tsx');
    expect(creator).toMatch(/onMoveLayer=\{\(layerId, point\) => applyMove\(layerId, \(state\) => moveLayerTo\(state, layerId, point, CANVAS_SIZE\), false\)\}/);
    const canvas = read('../components/OymoCanvas.tsx');
    // Live position is local; the design changes only in endDrag (on release).
    expect(canvas.match(/onMoveLayer\?\.\(/g)).toHaveLength(1);
    expect(canvas).toMatch(/const endDrag = \(\) => \{[\s\S]*?onMoveLayer\?\.\(/);
  });

  it('exports never draw guides or selection: only the editing canvas renders them', () => {
    const root = path.join(__dirname, '../../../..');
    const users: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) && /GuidesOverlay/.test(fs.readFileSync(full, 'utf8'))) users.push(path.relative(root, full));
      }
    };
    walk(root);
    expect(users.sort()).toEqual(['features/culture/oymo/components/OymoCanvas.tsx', 'features/culture/oymo/guides/GuidesOverlay.tsx']);
    const canvas = read('../components/OymoCanvas.tsx');
    const plain = canvas.slice(canvas.indexOf('function PlainOymoCanvas'));
    expect(plain).not.toMatch(/GuidesOverlay|guides/);
    expect(canvas).toMatch(/\{preview \? null : <GuidesOverlay/);
    const artwork = read('../components/OymoArtwork.tsx').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(artwork).not.toMatch(/Guide|handle|selected/i);
  });

  it('KG / RU / EN carry every guides string (plurals included)', () => {
    const keys = (value: object, prefix = ''): string[] => Object.entries(value).flatMap(([key, child]) => (child && typeof child === 'object' ? keys(child as object, `${prefix}${key}.`) : [`${prefix}${key}`]));
    const enKeys = keys(en.guides).sort();
    expect(keys(ru.guides).sort()).toEqual(enKeys);
    expect(keys(kg.guides).sort()).toEqual(enKeys);
    for (const form of ['one', 'few', 'many', 'other']) expect(enKeys).toContain(`spacingValue_${form}`);
  });
});
