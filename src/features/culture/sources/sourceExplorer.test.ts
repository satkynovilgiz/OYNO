import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import { explanationKey, explorerSources, FIELD_MAPPINGS_AVAILABLE, safeExternalUrl, sourceExplorerRoute } from './sourceExplorer';

const app = path.join(__dirname, '../../../app');
const screen = fs.readFileSync(path.join(__dirname, 'SourceExplorerScreen.tsx'), 'utf8');

describe('Source Explorer', () => {
  it('preserves the existing verification - fixed explanation per state, never upgraded', () => {
    expect(explanationKey('verified')).toEqual({ level: 'verified', key: 'sourceExplorer.why.verified' });
    expect(explanationKey('partially_verified').level).toBe('partially_verified');
    expect(explanationKey('anything-else').level).toBe('unverified');
    expect(explanationKey(null).level).toBe('unverified');
    expect(screen).not.toMatch(/accuracy_level\s*=|setLevel|upgrade/);
  });

  it('lists the recorded sources in order; a malformed entry is "Source unavailable", never linked', () => {
    const list = explorerSources(['https://ky.wikipedia.org/wiki/Боз_үй', 'not a url', 'javascript:alert(1)', 'https://example.org/a', 'https://ky.wikipedia.org/wiki/Боз_үй']);
    expect(list.map((entry) => entry.kind)).toEqual(['link', 'unavailable', 'unavailable', 'link']);
    expect(list[0]).toMatchObject({ kind: 'link', info: { name: 'Wikipedia (кыргызча)', kind: 'encyclopedia' } });
    expect(list[3]).toMatchObject({ info: { name: 'example.org', kind: 'website' } });
    expect(explorerSources(null)).toEqual([]);
  });

  it('only http(s) links can be opened', () => {
    expect(safeExternalUrl('https://unesco.org/x')).toBe('https://unesco.org/x');
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('file:///etc/passwd')).toBeNull();
    expect(safeExternalUrl('oyno://open/x')).toBeNull();
    expect(screen).toMatch(/const safe = safeExternalUrl\(url\);\s*if \(!safe\) return;/);
  });

  it('no inferred claim mapping (no regex/keyword/LLM matching of sources to fields)', () => {
    expect(FIELD_MAPPINGS_AVAILABLE).toBe(false);
    const code = (fs.readFileSync(path.join(__dirname, 'sourceExplorer.ts'), 'utf8') + screen).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    expect(code).not.toMatch(/history|cultural_meaning|traditional_method|\.match\(|includes\(item\[/);
    expect(code).not.toMatch(/fetch\(|supabase/);
  });

  it('offline: metadata comes from the cached story; opening needs a connection', () => {
    expect(screen).toMatch(/disabled=\{isOffline\}/);
    expect(screen).toMatch(/sourceExplorer\.offlineNote/);
    for (const route of ['culture/item/[itemId]/sources.tsx', 'culture/material/[materialId]/sources.tsx']) {
      expect(fs.existsSync(path.join(app, route))).toBe(true);
      expect(fs.readFileSync(path.join(app, route), 'utf8')).toMatch(/isWaitingForNetwork\(query\)/);
    }
  });

  it('missing story -> Not Found (no fake page)', () => {
    expect(fs.readFileSync(path.join(app, 'culture/item/[itemId]/sources.tsx'), 'utf8')).toMatch(/if \(!row\) return <NotFoundState/);
  });

  it('Glossary links to the UNDERLYING article’s explorer (no duplicate source records)', () => {
    const term = fs.readFileSync(path.join(__dirname, '../glossary/GlossaryTermScreen.tsx'), 'utf8');
    expect(term).toMatch(/sources=\{item\.sources\} contentId=\{item\.id\}/);
    expect(sourceExplorerRoute('culture_item', 'boz-uy-tunduk')).toBe('/culture/item/boz-uy-tunduk/sources');
    expect(sourceExplorerRoute('culture_material', 'komuz-discovery')).toBe('/culture/material/komuz-discovery/sources');
  });

  it('Compare / Then & Now keep separate provenance (each side its own explorer)', () => {
    const compare = fs.readFileSync(path.join(__dirname, '../compare/CultureCompareScreen.tsx'), 'utf8');
    expect(compare).toMatch(/\[left, right\]\.map\(\(item\) =>[\s\S]*contentId=\{item\.id\}/);
    expect(screen).toMatch(/explorerSources\(sources\)/);
    expect(screen.match(/sources:/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });

  it('analytics: only content_id and source_id', () => {
    for (const call of screen.match(/track\([^)]*\)/g) ?? []) expect(call).toMatch(/track\('(source_explorer_opened|external_source_opened)', \{ content_id: contentId(, source_id: sourceId)? \}\)/);
  });

  it('KG / RU / EN', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { sourceExplorer: Record<string, unknown> }).sourceExplorer;
      for (const key of ['title', 'whyThisStatus', 'supports', 'openSource', 'externalWebsite', 'sourceUnavailable']) expect(block[key]).toBeTruthy();
      expect(Object.keys(block.level as object)).toEqual(['verified', 'partially_verified', 'unverified']);
    }
    expect((en as unknown as { sourceExplorer: { why: { partially_verified: string } } }).sourceExplorer.why.partially_verified).toMatch(/Some claims still need additional review/);
  });
});
