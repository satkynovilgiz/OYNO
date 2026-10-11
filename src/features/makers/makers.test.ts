import fs from 'fs';
import path from 'path';

import { FIXTURE_LABEL, FIXTURE_MAKERS, MAKERS, MAKERS_PUBLIC_ENABLED, publicMakers, resolveMedia, validateMaker, type MakerProfile } from './makersModel';

const valid = (overrides: Partial<MakerProfile> = {}): MakerProfile => ({
  id: 'test-maker',
  fixture: false,
  reviewStatus: 'approved',
  name: 'Test Name',
  craft: 'felt',
  region: null,
  bio: { kg: 'Тест.' },
  relatedArticleIds: [],
  media: [{ kind: 'photo', uri: 'https://example.test/p.jpg', description: { kg: 'Сүрөт.' }, credit: 'Test', license: 'CC BY 4.0' }],
  consent: { status: 'granted', scope: ['name', 'bio', 'photo'], recordedOn: '2026-01-01', reference: 'TEST-1' },
  ...overrides,
});

describe('schema validation', () => {
  it('accepts a complete, consented, approved profile', () => {
    expect(validateMaker(valid())).toEqual([]);
  });
  it.each([
    ['pending consent', { consent: { status: 'pending', scope: ['name', 'bio'], recordedOn: null, reference: null } }, 'consent is pending'],
    ['withdrawn consent', { consent: { status: 'withdrawn', scope: ['name', 'bio'], recordedOn: '2026-01-01', reference: 'X' } }, 'consent is withdrawn'],
    ['granted without a record', { consent: { status: 'granted', scope: ['name', 'bio'], recordedOn: null, reference: null } }, 'granted consent needs a recorded date and a reference'],
    ['no Kyrgyz bio', { bio: { en: 'Only English.' } }, 'a Kyrgyz bio is required'],
    ['region outside consent', { region: 'Naryn' }, 'consent does not cover "region"'],
    ['not reviewed', { reviewStatus: 'in_review' }, 'review status is in_review'],
    ['bad id', { id: 'Bad Id' }, 'id must be lowercase letters, digits and dashes'],
  ] as [string, Partial<MakerProfile>, string][])('rejects %s', (_label, overrides, error) => {
    expect(validateMaker(valid(overrides as Partial<MakerProfile>))).toContain(error);
  });
  it('rejects media without consent, credit or description, and unknown articles', () => {
    const errors = validateMaker(valid({ relatedArticleIds: ['nope'], media: [{ kind: 'audio', uri: 'https://example.test/a.m4a', description: {}, credit: null, license: null }] }), (id) => id !== 'nope');
    expect(errors).toEqual(expect.arrayContaining(['related article "nope" does not exist', 'media 0 (audio) is not covered by consent', 'media 0 needs a credit and a license', 'media 0 needs a Kyrgyz description']));
  });
});

describe('media fallback', () => {
  const { consent } = valid();
  it('shows consented, credited, described media', () => {
    expect(resolveMedia(valid().media[0], consent, 'en')).toMatchObject({ kind: 'photo', description: 'Сүрөт.', credit: 'Test' });
  });
  it('falls back to a placeholder - never a stand-in', () => {
    expect(resolveMedia({ ...valid().media[0], uri: null }, consent, 'kg')).toEqual({ kind: 'placeholder', of: 'photo', reason: 'missing' });
    expect(resolveMedia({ ...valid().media[0], kind: 'video' }, consent, 'kg')).toEqual({ kind: 'placeholder', of: 'video', reason: 'no_consent' });
    expect(resolveMedia(valid().media[0], { ...consent, status: 'withdrawn' }, 'kg')).toMatchObject({ reason: 'no_consent' });
    expect(resolveMedia({ ...valid().media[0], license: null }, consent, 'kg')).toMatchObject({ reason: 'no_credit' });
    expect(resolveMedia({ ...valid().media[0], description: {} }, consent, 'kg')).toMatchObject({ reason: 'no_description' });
  });
  it("the fixture's media all fall back", () => {
    for (const media of FIXTURE_MAKERS[0].media) expect(resolveMedia(media, FIXTURE_MAKERS[0].consent, 'en').kind).toBe('placeholder');
  });
});

describe('fixture exclusion and the hidden entry', () => {
  it('there are no real profiles yet and the public entry is off', () => {
    expect(MAKERS).toEqual([]);
    expect(MAKERS_PUBLIC_ENABLED).toBe(false);
    expect(publicMakers([valid()])).toEqual([]);
  });
  it('fixtures are labelled and always invalid for public use', () => {
    for (const fixture of FIXTURE_MAKERS) {
      expect(fixture.fixture).toBe(true);
      expect(fixture.name).toContain(FIXTURE_LABEL);
      expect(validateMaker(fixture)).toContain('fixture data is never public');
    }
  });
  it('no public route or non-admin screen links to the makers feature', () => {
    const root = path.join(__dirname, '..', '..');
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !full.includes(`${path.sep}makers${path.sep}`) && !full.includes(`${path.sep}admin${path.sep}`) && /features\/makers|\/makers['"`]/.test(fs.readFileSync(full, 'utf8'))) hits.push(path.relative(root, full));
      }
    };
    walk(root);
    expect(hits).toEqual([]);
  });
});
