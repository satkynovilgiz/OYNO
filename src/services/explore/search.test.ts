import { groupSearchResults, matchesQuery, normalizeSearchQuery, searchExploreContent, type SearchItem } from './search';

const items: SearchItem[] = [
  { id: 'ysyk-kol', kind: 'region', names: { kg: 'Ысык-Көл', ru: 'Иссык-Куль', en: 'Issyk-Kul' } },
  { id: 'son-kol', kind: 'nature', names: { kg: 'Сон-Көл', ru: 'Сон-Куль', en: 'Son-Kul' } },
  { id: 'boz-uy', kind: 'discovery', names: { kg: 'Боз үй', ru: 'Боз үй', en: 'Boz Uy' } },
];

describe('normalizeSearchQuery', () => {
  it('trims and lowercases', () => {
    expect(normalizeSearchQuery('  Ысык-Көл  ')).toBe('ысык-көл');
  });
});

describe('matchesQuery', () => {
  it('matches against any localized name', () => {
    expect(matchesQuery(items[0], 'issyk')).toBe(true);
    expect(matchesQuery(items[0], 'ысык')).toBe(true);
  });

  it('does not match an empty query', () => {
    expect(matchesQuery(items[0], '')).toBe(false);
  });

  it('does not match unrelated text', () => {
    expect(matchesQuery(items[0], 'talas')).toBe(false);
  });
});

describe('searchExploreContent', () => {
  it('returns an empty list for an empty/whitespace query', () => {
    expect(searchExploreContent(items, '   ')).toEqual([]);
  });

  it('filters across kinds', () => {
    expect(searchExploreContent(items, 'көл').map((i) => i.id)).toEqual(['ysyk-kol', 'son-kol']);
  });
});

describe('groupSearchResults', () => {
  it('groups results by kind, including empty kinds', () => {
    const grouped = groupSearchResults([items[0]]);
    expect(grouped.region).toEqual([items[0]]);
    expect(grouped.nature).toEqual([]);
    expect(grouped.discovery).toEqual([]);
  });
});
