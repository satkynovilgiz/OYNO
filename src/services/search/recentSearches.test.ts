import { accountBoundKeys } from '@/services/sync/accountScope';

import { addRecentSearch, isStorableQuery, RECENT_SEARCHES_KEY } from './recentSearches';

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

describe('recent search privacy', () => {
  it('never keeps an email address or a long pasted passage', () => {
    expect(addRecentSearch(['ordo'], 'someone@example.com')).toEqual(['ordo']);
    expect(addRecentSearch(['ordo'], 'x'.repeat(61))).toEqual(['ordo']);
    expect(isStorableQuery('Соң-Көл')).toBe(true);
  });

  it('collapses inner whitespace so "соң  көл" and "соң көл" are one entry', () => {
    expect(addRecentSearch(['соң көл'], '  соң   көл ')).toEqual(['соң көл']);
  });

  it('is registered as account-bound, so sign-out / account switch clears it', () => {
    expect(accountBoundKeys()).toContain(RECENT_SEARCHES_KEY);
  });
});
