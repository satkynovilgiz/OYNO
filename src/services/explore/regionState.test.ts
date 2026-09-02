import { calculateRegionCompletion, type RegionCompletionInput } from './regionState';

const base: RegionCompletionInput = {
  published: true,
  visited: false,
  discoveriesTotal: 0,
  discoveriesFound: 0,
  questStepsTotal: 0,
  questStepsCompleted: 0,
};

describe('calculateRegionCompletion', () => {
  it('is locked when not published, regardless of visit state', () => {
    expect(calculateRegionCompletion({ ...base, published: false, visited: true })).toEqual({
      percent: 0,
      state: 'locked',
    });
  });

  it('is available when published but never visited', () => {
    expect(calculateRegionCompletion(base)).toEqual({ percent: 0, state: 'available' });
  });

  it('is explored when visited with no linked discoveries or quest steps', () => {
    expect(calculateRegionCompletion({ ...base, visited: true })).toEqual({ percent: 100, state: 'explored' });
  });

  it('is started when visited but linked discoveries are only partially found', () => {
    const result = calculateRegionCompletion({
      ...base,
      visited: true,
      discoveriesTotal: 2,
      discoveriesFound: 1,
    });
    expect(result.state).toBe('started');
    expect(result.percent).toBe(67);
  });

  it('is explored (not completed) once discoveries are fully found and no quest step targets it', () => {
    const result = calculateRegionCompletion({
      ...base,
      visited: true,
      discoveriesTotal: 2,
      discoveriesFound: 2,
    });
    expect(result).toEqual({ percent: 100, state: 'explored' });
  });

  it('is started when discoveries are done but a targeting quest step is not', () => {
    const result = calculateRegionCompletion({
      ...base,
      visited: true,
      discoveriesTotal: 1,
      discoveriesFound: 1,
      questStepsTotal: 1,
      questStepsCompleted: 0,
    });
    expect(result.state).toBe('started');
    expect(result.percent).toBe(67);
  });

  it('is completed when discoveries and every targeting quest step are done', () => {
    const result = calculateRegionCompletion({
      ...base,
      visited: true,
      discoveriesTotal: 1,
      discoveriesFound: 1,
      questStepsTotal: 1,
      questStepsCompleted: 1,
    });
    expect(result).toEqual({ percent: 100, state: 'completed' });
  });

  it('never exceeds 100% even if found/completed counts overshoot totals', () => {
    const result = calculateRegionCompletion({
      ...base,
      visited: true,
      discoveriesTotal: 1,
      discoveriesFound: 5,
      questStepsTotal: 1,
      questStepsCompleted: 5,
    });
    expect(result.percent).toBe(100);
  });
});
