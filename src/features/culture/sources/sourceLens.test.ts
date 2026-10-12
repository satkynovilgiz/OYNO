import { CULTURE_CONNECTIONS } from '@/features/culture/connections/connectionsData';

import { buildSourceLens, keepLensReturn, keepOpenLens, lensLink, openLensFor, takeLensReturn } from './sourceLensModel';

const article = (change: Partial<{ id: string; sources: string[] | null; accuracy_level: string | null; content_updated_at: string | null }> = {}) => ({ id: 'boz-uy-karkas', sources: ['https://ky.wikipedia.org/wiki/Боз_үй', 'https://example.org/page'], accuracy_level: 'verified', content_updated_at: '2026-09-01T00:00:00Z', ...change });

describe('metadata mapping', () => {
  it('shows only stored metadata: sources, review state, authored-text date', () => {
    const lens = buildSourceLens(article(), 'objects_used', []);
    expect(lens.sources.map((s) => (s.kind === 'link' ? s.info.name : 'x'))).toEqual(['Wikipedia (кыргызча)', 'example.org']);
    expect(lens).toMatchObject({ hasAttribution: true, level: 'verified', textUpdatedAt: '2026-09-01T00:00:00Z', sectionMapping: false, contributorQuotes: [] });
  });
  it("exact excerpts come from connections that quote THIS article's THIS section, word for word", () => {
    const lens = buildSourceLens(article(), 'objects_used', []);
    const expected = CULTURE_CONNECTIONS.filter((c) => c.source.contentId === 'boz-uy-karkas' && c.source.field === 'objects_used');
    expect(expected.length).toBeGreaterThan(0);
    expect(lens.excerpts).toEqual(expected.map((c) => ({ connectionId: c.id, evidence: c.evidence })));
    expect(buildSourceLens(article(), 'history', []).excerpts).toEqual([]);
    expect(buildSourceLens(article({ id: 'other' }), 'objects_used', []).excerpts).toEqual([]);
  });
});

describe('missing fields', () => {
  it('no sources -> no attribution (honest fallback); the level stays as stored', () => {
    expect(buildSourceLens(article({ sources: null, accuracy_level: 'partially_verified' }), 'history', [])).toMatchObject({ sources: [], hasAttribution: false, level: 'partially_verified' });
    expect(buildSourceLens(article({ sources: [] }), 'history', []).hasAttribution).toBe(false);
  });
  it('unknown or missing review state is "unverified" - never upgraded; bad dates are dropped', () => {
    expect(buildSourceLens(article({ accuracy_level: null }), 'history', []).level).toBe('unverified');
    expect(buildSourceLens(article({ accuracy_level: 'certain' }), 'history', []).level).toBe('unverified');
    expect(buildSourceLens(article({ content_updated_at: 'yesterday' }), 'history', []).textUpdatedAt).toBeNull();
    expect(buildSourceLens(article({ content_updated_at: null }), 'history', []).textUpdatedAt).toBeNull();
  });
  it('non-web entries are listed as unavailable, never linked', () => {
    const lens = buildSourceLens(article({ sources: ['Book, p. 12', 'javascript:alert(1)', 'https://ky.wikipedia.org/a'] }), 'history', []);
    expect(lens.sources.map((s) => s.kind)).toEqual(['unavailable', 'unavailable', 'link']);
    expect(lens.sources.map(lensLink)).toEqual([null, null, 'https://ky.wikipedia.org/a']);
  });
});

describe('links and personal notes', () => {
  it('links are exactly the recorded URL - nothing appended', () => {
    const lens = buildSourceLens(article({ sources: ['https://example.org/page?x=1'] }), 'history', [{ kind: 'bookmark', note: 'my private note' }]);
    const url = lensLink(lens.sources[0])!;
    expect(url).toBe('https://example.org/page?x=1');
    expect(url).not.toContain('private');
  });
  it('personal notes are kept apart from sources, and empty ones are left out', () => {
    const lens = buildSourceLens(article(), 'history', [{ kind: 'bookmark', note: '  mine  ' }, { kind: 'highlight', note: '   ' }]);
    expect(lens.personal).toEqual([{ kind: 'bookmark', note: 'mine' }]);
    expect(JSON.stringify(lens.sources)).not.toContain('mine');
    expect(lens.hasAttribution).toBe(true);
    expect(buildSourceLens(article({ sources: null }), 'history', [{ kind: 'bookmark', note: 'mine' }]).hasAttribution).toBe(false); // a note never counts as a source
  });
});

describe('source return', () => {
  it('the open lens is remembered per article while a source is visited', () => {
    keepOpenLens('boz-uy-karkas', 'objects_used');
    expect(openLensFor('boz-uy-karkas')).toBe('objects_used');
    expect(openLensFor('other')).toBeNull();
    keepOpenLens('boz-uy-karkas', null);
    expect(openLensFor('boz-uy-karkas')).toBeNull();
  });
  it('the article position is restored once, and only after leaving from an open lens', () => {
    keepLensReturn('a1', 702);
    expect(takeLensReturn('a1')).toBe(702);
    expect(takeLensReturn('a1')).toBeNull();
    keepLensReturn('a1', 0);
    expect(takeLensReturn('a1')).toBeNull();
  });
});
