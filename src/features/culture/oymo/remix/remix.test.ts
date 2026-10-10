import { CANVAS_SIZE } from '@/features/culture/oymo/components/OymoCanvas';
import type { MotifLayer } from '@/services/culture/oymoEditor';
import { computeMirroredPoints } from '@/services/culture/symmetry';
import { colors } from '@/theme';

import { applyRemix, bakedSymmetry, describeChanges, describeDesign, effectiveSymmetry, NO_CHANGE, PALETTES, remixSource, setRemixSource, symmetryOptions, toCreatorState, type RemixDesign } from './remixModel';

const layer = (id: number, x: number, y: number, color = '#2F5233', motifId = 'muyuz'): MotifLayer => ({ id: `layer${id}`, motifId, color, point: { x, y }, rotation: 0, scale: 1, visible: true });
const S = CANVAS_SIZE;

// A render-time design: originals only.
const plain: RemixDesign = { layers: [layer(0, 40, 50), layer(1, 90, 120, '#B9622F', 'kyal')], backgroundColor: '#EADCC0', symmetry: 'none' };
// The same motif placed as separate mirror copies (e.g. built by hand / opened from a game).
const bakedMirror: RemixDesign = { layers: [layer(0, 40, 50), layer(1, S - 40, 50), layer(2, S / 2, 200, '#B9622F')], backgroundColor: '#EADCC0', symmetry: 'none' };
const bakedFour: RemixDesign = { layers: [layer(0, 40, 50), layer(1, S - 40, 50), layer(2, 40, S - 50), layer(3, S - 40, S - 50)], backgroundColor: '#EADCC0', symmetry: 'none' };

/** Every rendered motif: what OymoArtwork draws. */
const rendered = (design: RemixDesign) =>
  design.layers
    .filter((entry) => entry.visible)
    .flatMap((entry) => computeMirroredPoints(entry.point, design.symmetry, S).map((point) => `${entry.motifId}|${entry.color}|${Math.round(point.x)},${Math.round(point.y)}`))
    .sort();

describe('symmetry already in the layers', () => {
  it('detects baked copies and only real off-axis groups', () => {
    expect(bakedSymmetry(plain.layers)).toBe('none');
    expect(bakedSymmetry(bakedMirror.layers)).toBe('mirror');
    expect(bakedSymmetry(bakedFour.layers)).toBe('fourWay');
    expect(bakedSymmetry([layer(0, S / 2, 40)])).toBe('none'); // on the axis only: nothing to merge
    // Copies must match: a different colour is not a copy.
    expect(bakedSymmetry([layer(0, 40, 50), layer(1, S - 40, 50, '#000000')])).toBe('none');
  });

  it('applying a stronger mode to baked layers never draws a motif twice', () => {
    const four = applyRemix(bakedMirror, { ...NO_CHANGE, symmetry: 'fourWay' });
    const points = rendered(four);
    expect(new Set(points).size).toBe(points.length);
    // Same as building the 4-way design from originals.
    expect(points).toEqual(rendered({ layers: [layer(0, 40, 50), layer(2, S / 2, 200, '#B9622F')], backgroundColor: '#EADCC0', symmetry: 'fourWay' }));
    expect(four.layers).toHaveLength(2);
    expect(effectiveSymmetry(four)).toBe('fourWay');
  });

  it('a weaker or the current mode is not offered (no deleting the user’s layers)', () => {
    expect(symmetryOptions(bakedFour).map((option) => [option.mode, option.available, option.reason])).toEqual([
      ['none', false, 'copiesInLayers'],
      ['mirror', false, 'copiesInLayers'],
      ['fourWay', false, 'current'],
    ]);
    expect(symmetryOptions(plain).filter((option) => option.available).map((option) => option.mode)).toEqual(['mirror', 'fourWay']);
    expect(symmetryOptions({ ...plain, symmetry: 'mirror' }).filter((option) => option.available).map((option) => option.mode)).toEqual(['none', 'fourWay']);
  });
});

describe('palette and background', () => {
  it('maps the design’s colours in order of first use onto the curated palette', () => {
    const variation = applyRemix(plain, { ...NO_CHANGE, palette: 'earth' });
    const earth = PALETTES.find((entry) => entry.id === 'earth')!.colors;
    expect(variation.layers.map((entry) => entry.color)).toEqual([earth[0], earth[1]]);
    // Same motifs, same places, same order.
    expect(variation.layers.map((entry) => [entry.id, entry.motifId, entry.point])).toEqual(plain.layers.map((entry) => [entry.id, entry.motifId, entry.point]));
  });

  it('the change list states what actually changed, and nothing it did not', () => {
    expect(describeChanges(plain, NO_CHANGE)).toEqual([]);
    expect(describeChanges(plain, { ...NO_CHANGE, background: colors.surfaceFeature })).toEqual([{ kind: 'background', from: '#EADCC0', to: colors.surfaceFeature }]);
    expect(describeChanges(plain, { ...NO_CHANGE, symmetry: 'mirror' })).toEqual([{ kind: 'symmetry', from: 'none', to: 'mirror', mergedLayers: 0 }]);
    expect(describeChanges(bakedMirror, { ...NO_CHANGE, symmetry: 'fourWay' })).toEqual([{ kind: 'symmetry', from: 'mirror', to: 'fourWay', mergedLayers: 1 }]);
    // The "greens" palette starts with the design's own first colour: only the second layer changes.
    expect(describeChanges(plain, { ...NO_CHANGE, palette: 'greens' })).toEqual([{ kind: 'palette', palette: 'greens', recoloured: 1 }]);
    // A palette that changes nothing is not reported.
    expect(describeChanges({ ...plain, layers: [plain.layers[0]] }, { ...NO_CHANGE, palette: 'greens' })).toEqual([]);
  });

  it('describes each design for the list comparison', () => {
    expect(describeDesign(plain)).toEqual({ layers: 2, visibleLayers: 2, shownMotifs: 2, colors: ['#2F5233', '#B9622F'], backgroundColor: '#EADCC0', symmetry: 'none' });
    expect(describeDesign({ ...plain, symmetry: 'fourWay' }).shownMotifs).toBe(8);
  });
});

describe('the original is never changed', () => {
  it('every variation is a deep copy', () => {
    const original = JSON.parse(JSON.stringify(bakedMirror)) as RemixDesign;
    const variation = applyRemix(original, { palette: 'darkLight', background: colors.accentGold, symmetry: 'fourWay' });
    variation.layers[0].point.x = 999;
    variation.layers[0].color = '#FFFFFF';
    expect(original).toEqual(bakedMirror);
  });

  it('the source slot is a copy, bound to its owner', () => {
    const design = JSON.parse(JSON.stringify(plain)) as RemixDesign;
    setRemixSource('user-a', design);
    design.layers[0].point.x = 1; // the Creator keeps editing
    expect(remixSource('user-a')?.layers[0].point.x).toBe(40);
    remixSource('user-a')!.layers[0].color = '#FFFFFF';
    expect(remixSource('user-a')?.layers[0].color).toBe('#2F5233');
    expect(remixSource('user-b')).toBeNull();
    expect(remixSource('user-a')).toBeNull(); // cleared once another account asked
  });

  it('the Creator copy is exactly the previewed variation', () => {
    const variation = applyRemix(bakedMirror, { palette: 'goldBrown', background: colors.surface, symmetry: 'fourWay' });
    const copy = toCreatorState(variation);
    expect(rendered({ layers: copy.state.layers, backgroundColor: copy.state.backgroundColor, symmetry: copy.symmetry })).toEqual(rendered(variation));
    expect(copy.state.backgroundColor).toBe(colors.surface);
    expect(copy.state.nextId).toBeGreaterThan(Math.max(...copy.state.layers.map((entry) => Number(entry.id.replace('layer', '')))));
  });
});
