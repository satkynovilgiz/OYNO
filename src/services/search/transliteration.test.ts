import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import type { CatalogContentType, CatalogItem } from '@/services/content/contentCatalog';

import {
  applySearchFilters,
  applyStateFilters,
  emptyReason,
  groupCounts,
  highlightRange,
  MATCH_SCORE,
  NO_FILTERS,
  rankSearchResults,
  scoreMatch,
  searchSkeleton,
  transliterateLatin,
} from './globalSearch';

// Cyrillic-only searchText: these prove the Latin match comes from the
// transliteration itself, not from an English alternate title.
const item = (id: string, contentType: CatalogContentType, title: string, extra: Partial<CatalogItem> = {}): CatalogItem => ({ id, contentType, title, metadata: null, thumbnail: null, route: `/x/${id}`, searchText: [title], ...extra });
const KOMUZ = item('komuz', 'culture_item', 'Комуз');
const KOK_BORU = item('kok-boru', 'game', 'Көк бөрү');
const KYZ = item('kyz-kuumay', 'game', 'Кыз куумай');
const BOORSOK = item('boorsok', 'culture_item', 'Боорсок');
const ISSYK = item('ysyk-kol', 'region', 'Ысык-Көл');
const SON_KOL = item('son-kol', 'nature', 'Соң-Көл');
const CHUKO = item('chuko', 'game', 'Чүкө');
const ORDO = item('ordo', 'game', 'Ордо');
const CATALOG = [KOMUZ, KOK_BORU, KYZ, BOORSOK, ISSYK, SON_KOL, CHUKO, ORDO];
const top = (query: string) => rankSearchResults(CATALOG, query)[0]?.item.id;

describe('Search 3.0 - transliteration (matching only)', () => {
  it.each([
    ['komuz', 'komuz'],
    ['kok boru', 'kok-boru'],
    ['kyz kuumai', 'kyz-kuumay'],
    ['boorsok', 'boorsok'],
    ['issyk kol', 'ysyk-kol'],
    ['son kol', 'son-kol'],
    ['chuko', 'chuko'],
    ['ordo', 'ordo'],
  ])('%s -> %s', (query, id) => {
    expect(top(query)).toBe(id);
  });

  it('multi-letter rules are deterministic', () => {
    expect(transliterateLatin('shyrdak')).toBe('шырдак');
    expect(transliterateLatin('chuko')).toBe('чуко');
    expect(transliterateLatin('jaa atuu')).toBe('жаа атуу');
    expect(transliterateLatin('zhaa')).toBe('жаа');
    expect(transliterateLatin('song')).toBe('сон');
    expect(searchSkeleton('Ысык-Көл')).toBe(searchSkeleton(transliterateLatin('issyk kol')));
  });

  it('existing Cyrillic behaviour is unchanged (folding still exact)', () => {
    expect(scoreMatch(KOK_BORU, 'Көк бөрү')).toBe(MATCH_SCORE.exact);
    expect(scoreMatch(KOK_BORU, 'кок бору')).toBe(MATCH_SCORE.exact);
    expect(scoreMatch(ISSYK, 'ысык көл')).toBe(MATCH_SCORE.exact);
  });

  it('an exact native title outranks a transliteration match', () => {
    const latinTitled = item('ordo-en', 'game', 'Ordo');
    const ranked = rankSearchResults([ORDO, latinTitled], 'ordo');
    expect(ranked.map((result) => result.item.id)).toEqual(['ordo-en', 'ordo']);
    expect(MATCH_SCORE.translitExact).toBeLessThan(MATCH_SCORE.altContains);
    expect(MATCH_SCORE.translitExact).toBeGreaterThan(MATCH_SCORE.metadata);
    expect(rankSearchResults([KOMUZ], 'Комуз')[0].score).toBeGreaterThan(rankSearchResults([KOMUZ], 'komuz')[0].score);
  });

  it('mixed input is safe ("kok бөрү") and nonsense finds nothing unrelated', () => {
    expect(top('kok бөрү')).toBe('kok-boru');
    expect(rankSearchResults(CATALOG, 'zzqx')).toEqual([]);
    expect(rankSearchResults(CATALOG, 'k').length).toBe(0);
  });

  it('a transliteration-only match never fakes a highlight', () => {
    expect(highlightRange('Комуз', 'komuz')).toBeNull();
    expect(highlightRange('Көк бөрү', 'kok boru')).toBeNull();
    expect(highlightRange('Комуз', 'ком')).toEqual([0, 3]);
  });
});

describe('Search 3.0 - filters', () => {
  const results = rankSearchResults([KOMUZ, BOORSOK, KOK_BORU, ORDO], 'о');
  const saved = (entry: CatalogItem) => entry.id === 'ordo' || entry.id === 'komuz';
  const offline = (entry: CatalogItem) => entry.id === 'boorsok';

  it('group filter + live counts from the current results', () => {
    expect(groupCounts(results)).toEqual([
      { id: 'culture', count: 2 },
      { id: 'games', count: 2 },
    ]);
    expect(applySearchFilters(results, { ...NO_FILTERS, group: 'games' }, saved, offline).map((result) => result.item.id).sort()).toEqual(['kok-boru', 'ordo']);
  });

  it('Saved only / Available offline / combined, ranking kept', () => {
    expect(applyStateFilters(results, { savedOnly: true, offlineOnly: false }, saved, offline).map((result) => result.item.id).sort()).toEqual(['komuz', 'ordo']);
    expect(applyStateFilters(results, { savedOnly: false, offlineOnly: true }, saved, offline).map((result) => result.item.id)).toEqual(['boorsok']);
    expect(applySearchFilters(results, { group: 'culture', savedOnly: true, offlineOnly: false }, saved, offline).map((result) => result.item.id)).toEqual(['komuz']);
    expect(applySearchFilters(results, { group: 'games', savedOnly: false, offlineOnly: true }, saved, offline)).toEqual([]);
  });

  it('filtered zero-state is honest about why', () => {
    expect(emptyReason(4, 0, { ...NO_FILTERS, savedOnly: true })).toBe('noSaved');
    expect(emptyReason(4, 0, { ...NO_FILTERS, offlineOnly: true })).toBe('noOffline');
    expect(emptyReason(4, 0, { ...NO_FILTERS, group: 'trails' })).toBe('noInGroup');
    expect(emptyReason(0, 0, NO_FILTERS)).toBe('noMatches');
    expect(emptyReason(4, 2, NO_FILTERS)).toBe('none');
  });

  it('queries stay local: no analytics, no network in search code', () => {
    for (const file of ['globalSearch.ts', '../../features/search/SearchScreen.tsx', '../../features/search/SearchFilterBar.tsx']) {
      const code = fs.readFileSync(path.join(__dirname, file), 'utf8');
      // (Retry calls `refetch()` on the existing catalogue queries - not a new request path.)
      expect(code).not.toMatch(/track\(|supabase|\bfetch\(/);
    }
    // Recent searches keep the query exactly as typed.
    expect(fs.readFileSync(path.join(__dirname, '../../features/search/SearchScreen.tsx'), 'utf8')).toMatch(/remember\(query\)/);
  });

  it('KG / RU / EN filter strings', () => {
    for (const dict of [kg, ru, en]) {
      const filters = (dict as unknown as { search: { filters: Record<string, unknown> } }).search.filters;
      const groups = filters.groups as Record<string, string>;
      for (const key of ['places', 'culture', 'games', 'trails', 'collections']) expect(groups[key]).toBeTruthy();
      for (const key of ['all', 'savedOnly', 'offlineOnly', 'clear']) expect(filters[key]).toBeTruthy();
      const empty = filters.empty as Record<string, string>;
      expect(empty.noSaved && empty.noOffline).toBeTruthy();
    }
  });
});
