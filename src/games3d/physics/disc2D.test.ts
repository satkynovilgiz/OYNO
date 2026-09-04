import { discsOverlap, distanceFromCenter, isDiscSettled, resolveDiscCollision, stepDisc2D } from './disc2D';
import type { Disc2D } from './disc2D';

function makeDisc(overrides: Partial<Disc2D> = {}): Disc2D {
  return { x: 0, z: 0, vx: 0, vz: 0, radius: 0.1, mass: 1, rotation: 0, angularVelocity: 0, ...overrides };
}

describe('disc2D', () => {
  it('stepDisc2D integrates position by velocity and decays velocity by friction', () => {
    const disc = makeDisc({ vx: 2, vz: 0 });
    const next = stepDisc2D(disc, 1, { friction: 0.5, angularFriction: 0, restitution: 0.5 });
    expect(next.x).toBeCloseTo(2);
    expect(next.vx).toBeCloseTo(1); // 2 * (1 - 0.5*1)
  });

  it('friction eventually brings a disc to rest, never reversing its direction', () => {
    let disc = makeDisc({ vx: 3, vz: 0 });
    for (let i = 0; i < 300; i += 1) {
      disc = stepDisc2D(disc, 1 / 60, { friction: 2, angularFriction: 2, restitution: 0.5 });
      expect(disc.vx).toBeGreaterThanOrEqual(0);
    }
    expect(isDiscSettled(disc)).toBe(true);
  });

  it('resolveDiscCollision separates two overlapping discs and reverses their closing velocity', () => {
    const a = makeDisc({ x: -0.05, vx: 1 });
    const b = makeDisc({ x: 0.05, vx: -1 });
    expect(discsOverlap(a, b)).toBe(true);

    const [resolvedA, resolvedB] = resolveDiscCollision(a, b, 1);
    expect(discsOverlap(resolvedA, resolvedB)).toBe(false);
    // They were closing (a moving +x, b moving -x); after an elastic
    // head-on collision of equal masses they should swap velocities.
    expect(resolvedA.vx).toBeCloseTo(-1);
    expect(resolvedB.vx).toBeCloseTo(1);
  });

  it('resolveDiscCollision does not add energy to discs that are separating, not closing', () => {
    const a = makeDisc({ x: -0.05, vx: -1 });
    const b = makeDisc({ x: 0.05, vx: 1 });
    const [resolvedA, resolvedB] = resolveDiscCollision(a, b, 1);
    // No collision impulse applied (already moving apart) - velocities unchanged.
    expect(resolvedA.vx).toBeCloseTo(-1);
    expect(resolvedB.vx).toBeCloseTo(1);
  });

  it('distanceFromCenter measures straight-line distance on the XZ plane', () => {
    const disc = makeDisc({ x: 3, z: 4 });
    expect(distanceFromCenter(disc, 0, 0)).toBeCloseTo(5);
  });
});
