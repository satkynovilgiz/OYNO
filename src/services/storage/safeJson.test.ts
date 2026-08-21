import { safeJsonParse } from './safeJson';

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
  });

  it('returns the fallback for null/undefined input', () => {
    expect(safeJsonParse(null, { default: true })).toEqual({ default: true });
    expect(safeJsonParse(undefined, { default: true })).toEqual({ default: true });
  });

  it('returns the fallback for an empty string', () => {
    expect(safeJsonParse('', { default: true })).toEqual({ default: true });
  });

  it('returns the fallback instead of throwing on corrupted JSON', () => {
    expect(safeJsonParse('{not valid json', { default: true })).toEqual({ default: true });
  });
});
