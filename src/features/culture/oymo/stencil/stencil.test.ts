import type { MotifLayer } from '@/services/culture/oymoEditor';

import { MOTIF_GEOMETRY } from '../motifGeometry';
import { A4, buildStencilPage, CANVAS, DEFAULT_SETTINGS, designBox, MM_PER_PT, placements, SAFE_MARGIN, setStencilSource, stencilHtml, stencilSource, stencilSvg, THICKNESS_MM, toCanvas, type StencilDesign, type StencilSettings } from './stencilModel';

const layer = (overrides: Partial<MotifLayer> = {}): MotifLayer => ({ id: 'l1', motifId: 'tortKulak', color: '#C0392B', point: { x: 60, y: 90 }, rotation: 0, scale: 1, visible: true, ...overrides });
const design = (layers: MotifLayer[], symmetry: StencilDesign['symmetry'] = 'none', name: string | null = null): StencilDesign => ({ layers, symmetry, name });
const texts = { motifName: (id: string) => `name:${id}`, note: 'NOTE TEXT' };
const settings = (change: Partial<StencilSettings> = {}): StencilSettings => ({ ...DEFAULT_SETTINGS, ...change });

/** Apply an SVG transform list (translate/rotate/scale only) to a point - like a renderer does. */
function applyTransform(transform: string, x: number, y: number) {
  const ops = [...transform.matchAll(/(translate|rotate|scale)\(([^)]+)\)/g)].map((m) => ({ op: m[1], args: m[2].trim().split(/[\s,]+/).map(Number) }));
  let point = { x, y };
  for (const { op, args } of ops.reverse()) {
    if (op === 'translate') point = { x: point.x + args[0], y: point.y + (args[1] ?? 0) };
    if (op === 'scale') point = { x: point.x * args[0], y: point.y * (args[1] ?? args[0]) };
    if (op === 'rotate') {
      const a = (args[0] * Math.PI) / 180;
      point = { x: point.x * Math.cos(a) - point.y * Math.sin(a), y: point.x * Math.sin(a) + point.y * Math.cos(a) };
    }
  }
  return point;
}

describe('transformation geometry', () => {
  it('centres the motif on its point like the canvas (36 pt box for 24 units)', () => {
    const [p] = placements(design([layer()]));
    expect(toCanvas(p, 12, 12)).toEqual({ x: 60, y: 90 });
    expect(toCanvas(p, 24, 12)).toEqual({ x: 78, y: 90 }); // half the 36 pt box
  });
  it('rotates clockwise and scales around the centre', () => {
    const [p] = placements(design([layer({ rotation: 90, scale: 2 })]));
    const right = toCanvas(p, 24, 12); // the motif's right edge -> below the centre after 90 deg
    expect(right.x).toBeCloseTo(60);
    expect(right.y).toBeCloseTo(90 + 36);
  });
  it("the SVG transform of every element maps points exactly like toCanvas", () => {
    for (const [rotation, scale] of [[0, 1], [45, 0.4], [270, 2.5], [15, 1.3]]) {
      const d = design([layer({ rotation, scale })]);
      const [p] = placements(d);
      const page = buildStencilPage(d, settings(), texts);
      for (const [x, y] of [[3, 12], [12, 3], [21, 21]]) {
        const viaSvg = applyTransform(page.elements[0].transform, x, y);
        const viaModel = toCanvas(p, x, y);
        expect(viaSvg.x).toBeCloseTo(viaModel.x, 2);
        expect(viaSvg.y).toBeCloseTo(viaModel.y, 2);
      }
    }
  });
  it('symmetry copies match the Creator: mirror x2, four-way x4, hidden layers left out', () => {
    expect(placements(design([layer()], 'mirror')).map((p) => [p.x, p.y])).toEqual([[60, 90], [240, 90]]);
    expect(placements(design([layer()], 'fourWay')).map((p) => [p.x, p.y])).toEqual([[60, 90], [240, 90], [60, 210], [240, 210]]);
    expect(placements(design([layer({ visible: false })], 'fourWay'))).toEqual([]);
    const page = buildStencilPage(design([layer()], 'fourWay'), settings(), texts);
    expect(page.elements).toHaveLength(4 * MOTIF_GEOMETRY.tortKulak.length);
  });
  it("uses the motif's own primitives - same paths, in order", () => {
    const page = buildStencilPage(design([layer({ motifId: 'umaiEne' })]), settings(), texts);
    expect(page.elements.map((e) => (e.kind === 'path' ? e.d : `circle ${e.cx},${e.cy},${e.r}`))).toEqual(MOTIF_GEOMETRY.umaiEne.map((g) => (g.kind === 'path' ? g.d : `circle ${g.cx},${g.cy},${g.r}`)));
  });
  it('prints the chosen thickness at every motif scale', () => {
    for (const thickness of ['thin', 'medium', 'thick'] as const) {
      const page = buildStencilPage(design([layer({ scale: 0.4 }), layer({ id: 'l2', scale: 2.5 })]), settings({ thickness }), texts);
      const k = page.box.size / CANVAS;
      for (const element of page.elements) {
        const local = (36 / 24) * (element.transform.includes('scale(0.6)') ? 0.4 : 2.5);
        expect(element.strokeWidth * local * k * MM_PER_PT).toBeCloseTo(THICKNESS_MM[thickness], 2);
      }
    }
  });
});

describe('page', () => {
  it.each(['portrait', 'landscape'] as const)('%s: the design square sits inside the safe margins with room for labels', (orientation) => {
    const box = designBox(orientation);
    const page = buildStencilPage(design([layer()]), settings({ orientation }), texts);
    expect([page.width, page.height]).toEqual(orientation === 'portrait' ? [A4.width, A4.height] : [A4.height, A4.width]);
    expect(box.x).toBeGreaterThanOrEqual(SAFE_MARGIN);
    expect(box.y).toBeGreaterThanOrEqual(SAFE_MARGIN);
    expect(box.x + box.size).toBeLessThanOrEqual(page.width - SAFE_MARGIN);
    expect(box.y + box.size + 50).toBeLessThanOrEqual(page.height - SAFE_MARGIN);
  });
  it('the PDF page is A4 in the chosen orientation with no browser margin', () => {
    const html = stencilHtml(buildStencilPage(design([layer()]), settings({ orientation: 'landscape' }), texts), 'landscape');
    expect(html).toContain('@page { size: A4 landscape; margin: 0; }');
    expect(html).toContain('viewBox="0 0 842 595"');
  });
});

describe('export field selection', () => {
  const named = design([layer(), layer({ id: 'l2', motifId: 'gul' })], 'none', 'Aida <pattern>');
  it('by default: the design only - no name, motif names, note, colours or background', () => {
    const svg = stencilSvg(buildStencilPage(named, settings(), texts));
    expect(svg).not.toContain('<text');
    expect(svg).not.toContain('Aida');
    expect(svg).not.toContain('name:');
    expect(svg).not.toContain('#C0392B');
    expect(svg).not.toMatch(/#EADCC0/i);
    expect(svg).not.toContain('<line'); // guides off
  });
  it('only the ticked labels, escaped', () => {
    const svg = stencilSvg(buildStencilPage(named, settings({ labels: ['name'] }), texts));
    expect(svg).toContain('Aida &lt;pattern&gt;');
    expect(svg).not.toContain('name:');
    expect(svg).not.toContain('NOTE TEXT');
    const all = buildStencilPage(named, settings({ labels: ['note', 'motifs', 'name'] }), texts);
    expect(all.labels.map((l) => l.field)).toEqual(['name', 'motifs', 'note']);
    expect(all.labels[1].text).toBe('name:tortKulak, name:gul');
  });
  it('a design without a name prints no name even when ticked', () => {
    expect(buildStencilPage(design([layer()]), settings({ labels: ['name'] }), texts).labels).toEqual([]);
  });
  it('guides only when chosen', () => {
    expect(buildStencilPage(named, settings({ guides: true }), texts).guides.length).toBeGreaterThan(0);
  });
});

describe('limitations', () => {
  it('an unknown motif is reported and left out - never substituted', () => {
    const page = buildStencilPage(design([layer({ motifId: 'notAMotif' }), layer({ id: 'l2' })]), settings(), texts);
    expect(page.limitations).toContainEqual({ kind: 'unknownMotif', motifIds: ['notAMotif'] });
    expect(page.elements).toHaveLength(MOTIF_GEOMETRY.tortKulak.length);
  });
  it('a filled dot is outlined as a ring, or kept solid (and explained) when too small for the line', () => {
    const thin = buildStencilPage(design([layer({ motifId: 'gul', scale: 2.5 })]), settings({ thickness: 'thin' }), texts);
    expect(thin.elements.filter((e) => e.kind === 'circle' && e.filled)).toHaveLength(0);
    const thick = buildStencilPage(design([layer({ motifId: 'balykOyuu', scale: 0.4 })]), settings({ thickness: 'thick' }), texts);
    expect(thick.elements.filter((e) => e.kind === 'circle' && e.filled)).toHaveLength(1);
    expect(thick.limitations.map((l) => l.kind)).toContain('smallDetail');
  });
  it('open line motifs are named as lines, not fillable areas', () => {
    const page = buildStencilPage(design([layer({ motifId: 'kyal' }), layer({ id: 'l2', motifId: 'tortKulak' })]), settings(), texts);
    expect(page.limitations.find((l) => l.kind === 'openLines')?.motifIds).toEqual(['kyal', 'tortKulak']);
  });
});

describe('the original design', () => {
  it('is never changed, and the handed-over copy is per owner', () => {
    const original = design([layer()], 'fourWay', 'Mine');
    const frozen = JSON.stringify(original);
    Object.freeze(original.layers[0]);
    buildStencilPage(original, settings({ guides: true, labels: ['name', 'motifs', 'note'], thickness: 'thick', orientation: 'landscape' }), texts);
    setStencilSource('user-a', original);
    expect(JSON.stringify(original)).toBe(frozen);
    expect(stencilSource('user-a')?.layers[0]).not.toBe(original.layers[0]);
    expect(stencilSource('user-b')).toBeNull();
  });
});
