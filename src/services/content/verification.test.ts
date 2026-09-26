import * as fs from 'fs';
import * as path from 'path';

import { getAdminSection } from '@/features/admin/sections';
import { QUESTIONS_WITH_CLAIMS_UNDER_REVIEW, QUESTION_BANK, questionReviewLevel } from '@/features/challenges/questionBank';
import { dailyDiscoveryPool } from '@/services/daily/dailyDiscovery';

import type { CultureItemRow } from './types';
import { describeSource, describeSources, normalizeVerification, verificationCopyKey, verificationError } from './verification';

jest.mock('@/services/admin/adminService', () => ({ fetchTable: jest.fn(), fetchViaRpc: jest.fn() }));

const ROOT = path.join(__dirname, '../../..');

describe('verification states', () => {
  it('maps stored values to three states; anything else is "unverified"', () => {
    expect(normalizeVerification('verified')).toBe('verified');
    expect(normalizeVerification('partially_verified')).toBe('partially_verified');
    expect(normalizeVerification('unverified')).toBe('unverified');
    expect(normalizeVerification('gold')).toBe('unverified');
    expect(normalizeVerification(null)).toBe('unverified');
    expect(verificationCopyKey('partially_verified')).toBe('sources.status.partially_verified');
  });
});

describe('sources', () => {
  it('describes a real URL by its publisher, never inventing a citation', () => {
    expect(describeSource('https://ky.wikipedia.org/wiki/Боз_үй')).toMatchObject({ name: 'Wikipedia (кыргызча)', kind: 'encyclopedia', host: 'ky.wikipedia.org' });
    expect(describeSource('https://www.sputnik.kg/x')).toMatchObject({ name: 'Sputnik Кыргызстан', kind: 'news', host: 'sputnik.kg' });
    expect(describeSource('https://www.instagram.com/p/abc/')).toMatchObject({ kind: 'social' });
    // Unknown site: shown by its own address, nothing made up.
    expect(describeSource('https://example-museum.kg/page')).toEqual({ url: 'https://example-museum.kg/page', host: 'example-museum.kg', name: 'example-museum.kg', kind: 'website' });
  });

  it('drops malformed / non-web entries and duplicates', () => {
    expect(describeSources(['not a url', 'javascript:alert(1)', 'https://24.kg/a', 'https://24.kg/a'])).toHaveLength(1);
    expect(describeSources(null)).toEqual([]);
  });

  it('the source model has no review date field (none is stored, so none is shown)', () => {
    const info = describeSource('https://24.kg/a')!;
    expect(Object.keys(info).sort()).toEqual(['host', 'kind', 'name', 'url']);
    const component = fs.readFileSync(path.join(ROOT, 'src/components/content/SourcesAndNotes.tsx'), 'utf8');
    expect(component).not.toMatch(/reviewed_at|lastReviewed|updated_at/);
  });
});

describe('editor rule: "verified" needs a real source', () => {
  it('pure rule', () => {
    expect(verificationError('verified', [])).toMatch(/source/);
    expect(verificationError('verified', ['nope'])).toMatch(/source/);
    expect(verificationError('verified', ['https://unesco.org/x'])).toBeNull();
    expect(verificationError('partially_verified', [])).toBeNull();
  });

  it('every admin section with a review state validates it before saving', () => {
    for (const [id, field] of [['culture_items', 'accuracy_level'], ['culture_materials', 'accuracy_level'], ['discoveries', 'accuracy_level'], ['explore_regions', 'status']] as const) {
      const section = getAdminSection(id)!;
      expect(section.validate?.({ [field]: 'verified', sources: '' })).toMatch(/source/);
      expect(section.validate?.({ [field]: 'verified', sources: 'https://unesco.org/x' })).toBeNull();
    }
  });

  it('the database enforces the same rule for new writes', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260927000003_content_verification.sql'), 'utf8');
    for (const table of ['culture_items', 'culture_materials', 'discoveries', 'explore_regions']) expect(sql).toMatch(new RegExp(`alter table public\\.${table} add constraint ${table}_verified_needs_sources`));
  });
});

describe('challenges never present unreviewed claims as settled', () => {
  it('question level follows its source, capped when the answer rests on a flagged claim', () => {
    expect(questionReviewLevel('tunduk-parts', 'partially_verified')).toBe('partially_verified');
    expect(questionReviewLevel('tunduk-parts', 'verified')).toBe('verified');
    expect(questionReviewLevel('kochkor-muyuz', 'verified')).toBe('partially_verified');
    expect(questionReviewLevel('anything', undefined)).toBe('unverified');
  });

  it('every flagged id is a real question', () => {
    const ids = new Set(QUESTION_BANK.map((question) => question.id));
    for (const id of QUESTIONS_WITH_CLAIMS_UNDER_REVIEW) expect(ids.has(id)).toBe(true);
  });
});

describe('Daily prefers reviewed content', () => {
  it('never draws an unverified entry as the fact of the day', () => {
    const base = { category_id: 'boz-uy', cultural_meaning: 'Текст.', sources: ['https://24.kg/a'] } as Partial<CultureItemRow>;
    const pool = dailyDiscoveryPool(
      [
        { ...base, id: 'a', accuracy_level: 'unverified' },
        { ...base, id: 'b', accuracy_level: 'partially_verified' },
        { ...base, id: 'c', accuracy_level: 'verified' },
      ] as CultureItemRow[],
      () => true,
    );
    expect(pool.map((item) => item.id).sort()).toEqual(['b', 'c']);
  });
});
