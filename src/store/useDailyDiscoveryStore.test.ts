import { addDailyCompletion } from './useDailyDiscoveryStore';

describe('addDailyCompletion', () => {
  it('records a completion for a date', () => {
    expect(addDailyCompletion({}, '2026-09-22', 'boz-uy-tunduk')).toEqual({ '2026-09-22': 'boz-uy-tunduk' });
  });

  it('keeps the first item if the same date is completed again', () => {
    const once = addDailyCompletion({}, '2026-09-22', 'boz-uy-tunduk');
    expect(addDailyCompletion(once, '2026-09-22', 'horse-eer')).toBe(once);
  });

  it('caps history to the newest dates', () => {
    let completions = {};
    for (let day = 0; day < 130; day += 1) {
      const key = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
      completions = addDailyCompletion(completions, key, `item-${day}`);
    }
    const keys = Object.keys(completions).sort();
    expect(keys).toHaveLength(120);
    expect(keys[keys.length - 1]).toBe(new Date(Date.UTC(2026, 0, 130)).toISOString().slice(0, 10));
  });
});
