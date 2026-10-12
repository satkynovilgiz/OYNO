import type { MotifLayer } from '@/services/culture/oymoEditor';

import { toCreatorState, type RemixDesign } from '../remix/remixModel';
import { applyAlternative, CHOOSABLE, colorLabSource, colorName, contrastRatio, grayscale, inspect, MACHADO, minRatio, NO_ALTERNATIVE, parseHex, relativeLuminance, setColorLabSource, simulate, simulateDesign, suggest, toHex } from './colorLabModel';

const layer = (id: string, color: string, x: number): MotifLayer => ({ id, motifId: 'gul', color, point: { x, y: 100 }, rotation: 30, scale: 1.2, visible: true });
const design: RemixDesign = { layers: [layer('layer0', '#6B4F2A', 60), layer('layer1', '#7A5A30', 120), layer('layer2', '#2F5233', 200)], backgroundColor: '#5E4426', symmetry: 'mirror' };

describe('WCAG reference cases', () => {
  it('relative luminance', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 6);
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#808080')).toBeCloseTo(0.2159, 4);
    expect(relativeLuminance('#F00')).toBeCloseTo(0.2126, 4);
  });
  it('contrast ratio', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBe(21);
    expect(contrastRatio('#FFFFFF', '#000000')).toBe(21);
    expect(contrastRatio('#123456', '#123456')).toBe(1);
    expect(contrastRatio('#767676', '#FFFFFF')).toBe(4.54); // the classic "just passes 4.5:1" grey
    expect(contrastRatio('#777777', '#FFFFFF')).toBe(4.48);
    expect(contrastRatio('#FF0000', '#FFFFFF')).toBe(4);
  });
  it('hex parsing', () => {
    expect(parseHex('#abc')).toEqual([170, 187, 204]);
    expect(parseHex('nope')).toBeNull();
    expect(toHex([255, 0, 128.4])).toBe('#FF0080');
  });
});

describe('grayscale and colour-vision approximations', () => {
  it('grayscale keeps the luminance', () => {
    expect(grayscale('#FFFFFF')).toBe('#FFFFFF');
    expect(grayscale('#808080')).toBe('#808080');
    for (const hex of ['#2F5233', '#C0392B', '#E8B04B']) expect(relativeLuminance(grayscale(hex))).toBeCloseTo(relativeLuminance(hex), 2);
  });
  it('Machado 2009 matrices keep white white and greys grey (rows sum to 1)', () => {
    for (const matrix of Object.values(MACHADO)) for (const row of matrix) expect(row[0] + row[1] + row[2]).toBeCloseTo(1, 2);
    for (const vision of ['protanopia', 'deuteranopia', 'tritanopia'] as const) {
      expect(simulate('#FFFFFF', vision)).toBe('#FFFFFF');
      expect(simulate('#000000', vision)).toBe('#000000');
      const [r, g, b] = parseHex(simulate('#808080', vision))!;
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(2);
    }
  });
  it('red and green move closer together under protanopia/deuteranopia (the known confusion axis)', () => {
    expect(colorName('#D02020').hue).not.toBe(colorName('#20A020').hue);
    for (const vision of ['protanopia', 'deuteranopia'] as const) {
      const [r1, g1] = parseHex(simulate('#D02020', vision))!;
      const [r2, g2] = parseHex(simulate('#20A020', vision))!;
      // both land in the red-green-collapsed yellow/brown/olive range: red and green channels similar within each colour
      expect(Math.abs(r1 - g1)).toBeLessThan(60);
      expect(Math.abs(r2 - g2)).toBeLessThan(60);
    }
  });
  it('a simulated design has the same geometry', () => {
    const shown = simulateDesign(design, 'deuteranopia');
    expect(shown.layers.map(({ color: _c, ...rest }) => rest)).toEqual(design.layers.map(({ color: _c, ...rest }) => rest));
  });
});

describe('text names', () => {
  it('names colours deterministically, always with the hex', () => {
    expect(colorName('#000000')).toEqual({ lightness: 'dark', hue: 'black', hex: '#000000' });
    expect(colorName('#FFFFFF')).toEqual({ lightness: 'light', hue: 'white', hex: '#FFFFFF' });
    expect(colorName('#2F5233')).toMatchObject({ lightness: 'dark', hue: 'green' });
    expect(colorName('#C0392B')).toMatchObject({ lightness: 'medium', hue: 'red' });
    expect(colorName('#6B4F2A')).toMatchObject({ hue: 'brown' });
    expect(colorName('#808080').hue).toBe('gray');
  });
});

describe('inspect and alternatives', () => {
  it('lists every pair, weakest first, and flags those under 3:1', () => {
    const report = inspect(design);
    expect(report.colors).toEqual(['#6B4F2A', '#7A5A30', '#2F5233']);
    expect(report.pairs).toHaveLength(3 + 3);
    expect(report.pairs.map((p) => p.ratio)).toEqual([...report.pairs.map((p) => p.ratio)].sort((a, b) => a - b));
    expect(report.hard.every((p) => p.ratio < 3)).toBe(true);
    expect(report.hard.length).toBeGreaterThan(0);
  });
  it('an alternative is a deep copy with the same geometry; the original is untouched', () => {
    const before = JSON.stringify(design);
    const alt = applyAlternative(design, { replacements: { '#6B4F2A': '#FFFFFF' }, background: '#000000' });
    expect(alt.layers[0].color).toBe('#FFFFFF');
    expect(alt.backgroundColor).toBe('#000000');
    expect(alt.layers.map(({ color: _c, ...rest }) => rest)).toEqual(design.layers.map(({ color: _c, ...rest }) => rest));
    alt.layers[0].point.x = 999;
    expect(JSON.stringify(design)).toBe(before);
    expect(applyAlternative(design, NO_ALTERNATIVE)).toEqual(design);
  });
  it('the Creator copy is exactly the previewed alternative', () => {
    const alt = applyAlternative(design, { replacements: { '#2F5233': CHOOSABLE[3] }, background: null });
    const { state, symmetry } = toCreatorState(alt);
    expect(state.layers).toEqual(alt.layers);
    expect(state.backgroundColor).toBe(alt.backgroundColor);
    expect(symmetry).toBe('mirror');
    expect(state.layers[0]).not.toBe(alt.layers[0]);
  });
  it('the suggestion is deterministic, improves the weakest pair, and is never applied by itself', () => {
    const a = suggest(design);
    const b = suggest(design);
    expect(a).toEqual(b);
    expect(a!.minRatio).toBeGreaterThan(minRatio(design));
    expect(minRatio(applyAlternative(design, a!.alternative))).toBe(a!.minRatio);
    expect(design.layers[0].color).toBe('#6B4F2A');
  });
  it('no suggestion when nothing beats the original', () => {
    const strong: RemixDesign = { layers: [layer('layer0', '#000000', 60)], backgroundColor: '#FFFFFF', symmetry: 'none' };
    expect(suggest(strong)).toBeNull();
  });
  it('the handed-over design is per owner and a copy', () => {
    setColorLabSource('user-a', design, 'Mine');
    expect(colorLabSource('user-b')).toBeNull();
    const got = colorLabSource('user-a')!;
    got.design.layers[0].color = '#000000';
    expect(colorLabSource('user-a')!.design.layers[0].color).toBe('#6B4F2A');
  });
});
