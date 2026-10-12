import { EXPLORER_ILLUSTRATIONS, FIXTURE_ILLUSTRATION, keepSelection, nextZoom, SCHEMATIC, SCHEMATIC_POLES, selectionFor, sourceRoute, toScreen, validateIllustration, type ExplorerIllustration } from './explorerModel';

const point = (id: string) => FIXTURE_ILLUSTRATION.points.find((p) => p.id === id)!;
const inSchematic = (p: { x: number; y: number }) => ({ x: p.x * SCHEMATIC.width, y: p.y * SCHEMATIC.height });

describe('coordinate mapping', () => {
  it.each([[320, 1], [320, 2], [412, 1.5], [520, 2]] as const)('at %ipx and zoom %s a point keeps the same relative spot', (width, zoom) => {
    for (const entry of FIXTURE_ILLUSTRATION.points) {
      const { left, top } = toScreen(entry, width, zoom, FIXTURE_ILLUSTRATION.aspect);
      const w = width * zoom;
      const h = w / FIXTURE_ILLUSTRATION.aspect;
      expect(left / w).toBeCloseTo(entry.x, 6);
      expect(top / h).toBeCloseTo(entry.y, 6);
    }
  });
  it('zoom steps 1 -> 1.5 -> 2 and stops', () => {
    expect([nextZoom(1), nextZoom(1.5), nextZoom(2)]).toEqual([1.5, 2, 2]);
  });
});

describe('the fixture: points sit on the parts the schematic draws', () => {
  it('tunduk at the crown centre', () => {
    const p = inSchematic(point('tunduk'));
    expect(p.x).toBeCloseTo(SCHEMATIC.tunduk.cx, 1);
    expect(p.y).toBeCloseTo(SCHEMATIC.tunduk.cy, 1);
  });
  it('uuk on a roof pole', () => {
    const p = inSchematic(point('uuk'));
    const pole = SCHEMATIC_POLES[0];
    const cross = (pole.x2 - pole.x1) * (p.y - pole.y1) - (pole.y2 - pole.y1) * (p.x - pole.x1);
    expect(Math.abs(cross) / Math.hypot(pole.x2 - pole.x1, pole.y2 - pole.y1)).toBeLessThan(0.2);
  });
  it('kerege on the wall lattice, not the door; bosogo inside the door frame', () => {
    const { kerege, door } = SCHEMATIC;
    const inside = (q: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) => q.x > r.x && q.x < r.x + r.w && q.y > r.y && q.y < r.y + r.h;
    expect(inside(inSchematic(point('kerege')), kerege)).toBe(true);
    expect(inside(inSchematic(point('kerege')), door)).toBe(false);
    expect(inside(inSchematic(point('bosogo')), door)).toBe(true);
  });
  it('every point has an inspectable source in the reviewed overview article', () => {
    for (const entry of FIXTURE_ILLUSTRATION.points) {
      expect(entry.source).toEqual({ articleId: 'boz-uy-overview', sectionKey: 'objects_used' });
      expect(entry.nameKey).toMatch(/^culture\.bozUy\.steps\.\w+\.name$/);
    }
  });
});

describe('validation', () => {
  const base = (change: Partial<ExplorerIllustration>): ExplorerIllustration => ({ ...FIXTURE_ILLUSTRATION, fixture: false, credit: 'X', license: 'CC BY 4.0', ...change });
  it('a real illustration with credit, licence and in-range sourced points passes', () => {
    expect(validateIllustration(base({}))).toEqual([]);
  });
  it('catches missing credit, bad ids, duplicates, out-of-range and unsourced points', () => {
    const bad = base({
      credit: null,
      points: [
        { ...point('tunduk'), id: 'Tunduk 1' },
        { ...point('uuk'), x: 1.2 },
        { ...point('uuk') },
        { ...point('uuk'), id: 'kerege', source: { articleId: '', sectionKey: '' } },
      ],
    });
    expect(validateIllustration(bad)).toEqual(expect.arrayContaining(['a real illustration needs a credit and a licence', 'point id "Tunduk 1" is not stable (lowercase, digits, dashes)', 'point "uuk" is outside the image', 'duplicate point id "uuk"', 'point "kerege" has no source']));
  });
  it('reports a missing source article', () => {
    expect(validateIllustration(base({}), (id) => id !== 'boz-uy-overview')).toContain('point "tunduk": source article "boz-uy-overview" is unavailable');
  });
  it('nothing is public yet; the fixture never is', () => {
    expect(EXPLORER_ILLUSTRATIONS).toEqual([]);
    expect(validateIllustration(FIXTURE_ILLUSTRATION)).toEqual(['fixture - internal only']);
  });
});

describe('selection and navigation', () => {
  it('survives leaving for the source and coming back; an unknown id is dropped', () => {
    keepSelection(FIXTURE_ILLUSTRATION.id, 'uuk');
    expect(selectionFor(FIXTURE_ILLUSTRATION)).toBe('uuk');
    keepSelection(FIXTURE_ILLUSTRATION.id, 'gone');
    expect(selectionFor(FIXTURE_ILLUSTRATION)).toBeNull();
    keepSelection(FIXTURE_ILLUSTRATION.id, null);
    expect(selectionFor(FIXTURE_ILLUSTRATION)).toBeNull();
  });
  it('opens the source article at its section', () => {
    expect(sourceRoute({ articleId: 'boz-uy-overview', sectionKey: 'objects_used' })).toBe('/culture/item/boz-uy-overview?section=objects_used');
  });
});
