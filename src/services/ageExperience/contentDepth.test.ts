import { resolveContentByDepth } from './contentDepth';

describe('resolveContentByDepth', () => {
  it('returns the requested depth when it exists', () => {
    expect(resolveContentByDepth({ simple: 'short version', standard: 'full version' }, 'simple')).toBe(
      'short version',
    );
  });

  it('falls back to standard when the requested depth is missing', () => {
    expect(resolveContentByDepth({ standard: 'full version' }, 'simple')).toBe('full version');
  });

  it('falls back to standard when the requested depth is an empty string', () => {
    expect(resolveContentByDepth({ simple: '', standard: 'full version' }, 'simple')).toBe('full version');
  });

  it('falls back to standard when the requested depth is advanced but no advanced variant exists', () => {
    expect(resolveContentByDepth({ standard: 'full version' }, 'advanced')).toBe('full version');
  });

  it('returns null when neither the requested depth nor standard exist', () => {
    expect(resolveContentByDepth({}, 'simple')).toBeNull();
  });

  it('returns standard itself when depth is standard', () => {
    expect(resolveContentByDepth({ simple: 'short', standard: 'full' }, 'standard')).toBe('full');
  });
});
