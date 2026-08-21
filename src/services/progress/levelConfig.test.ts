import { levelForXp, xpForLevelStart, xpProgress } from './levelConfig';

describe('levelForXp', () => {
  it('returns level 1 for 0 or negative xp', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(-50)).toBe(1);
  });

  it('returns level 2 at exactly the threshold', () => {
    expect(levelForXp(500)).toBe(2);
  });

  it('returns level 3 partway through its range', () => {
    expect(levelForXp(1000)).toBe(3);
    expect(levelForXp(1499)).toBe(3);
  });
});

describe('xpForLevelStart', () => {
  it('level 1 starts at 0', () => {
    expect(xpForLevelStart(1)).toBe(0);
  });

  it('level 3 starts at 1000', () => {
    expect(xpForLevelStart(3)).toBe(1000);
  });
});

describe('xpProgress', () => {
  it('splits xp into level + progress within that level', () => {
    expect(xpProgress(1250)).toEqual({ level: 3, xpCurrent: 250, xpMax: 500 });
  });

  it('handles the exact boundary of a level', () => {
    expect(xpProgress(1000)).toEqual({ level: 3, xpCurrent: 0, xpMax: 500 });
  });
});
