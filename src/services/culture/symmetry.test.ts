import { computeMirroredPoints } from './symmetry';

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
