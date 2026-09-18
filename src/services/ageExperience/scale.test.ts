import { resolveByCardScale, resolveTouchTargetSize } from './scale';

describe('resolveByCardScale', () => {
  it('picks the value matching the given cardScale', () => {
    const values = { large: 1, medium: 2, compact: 3, dense: 4 };
    expect(resolveByCardScale('large', values)).toBe(1);
    expect(resolveByCardScale('medium', values)).toBe(2);
    expect(resolveByCardScale('compact', values)).toBe(3);
    expect(resolveByCardScale('dense', values)).toBe(4);
  });
});

describe('resolveTouchTargetSize', () => {
  it('shrinks from large (child) to dense (adult) but never below 44', () => {
    const large = resolveTouchTargetSize('large');
    const medium = resolveTouchTargetSize('medium');
    const compact = resolveTouchTargetSize('compact');
    const dense = resolveTouchTargetSize('dense');
    expect(large).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(compact);
    expect(compact).toBeGreaterThanOrEqual(dense);
    expect(dense).toBeGreaterThanOrEqual(44);
  });
});
