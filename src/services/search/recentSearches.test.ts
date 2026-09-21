import { addRecentSearch } from './recentSearches';

describe('addRecentSearch', () => {
  it('adds a new query to the front', () => {
    expect(addRecentSearch(['ordo'], 'комуз')).toEqual(['комуз', 'ordo']);
  });

  it('ignores an empty/whitespace-only query', () => {
    expect(addRecentSearch(['ordo'], '   ')).toEqual(['ordo']);
  });

  it('moves a re-searched term back to the front instead of duplicating it', () => {
    expect(addRecentSearch(['ordo', 'комуз'], 'ordo')).toEqual(['ordo', 'комуз']);
  });

  it('de-duplicates case-insensitively', () => {
    expect(addRecentSearch(['Ordo'], 'ordo')).toEqual(['ordo']);
  });

  it('caps the list at 8 entries', () => {
    const full = Array.from({ length: 8 }, (_, i) => `q${i}`);
    const result = addRecentSearch(full, 'new');
    expect(result).toHaveLength(8);
    expect(result[0]).toBe('new');
    expect(result).not.toContain('q7');
  });
});
