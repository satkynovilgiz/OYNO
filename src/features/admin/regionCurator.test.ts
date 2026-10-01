import fs from 'fs';
import path from 'path';

import { listRegionExperiences, resolveRegionExperiences, regionIntroOverride } from '@/features/explore/regions/regionExperiences';
import { fetchRegionLinks } from '@/services/content/regionLinksService';
import { supabase } from '@/services/supabase/client';

import {
  addItem,
  draftFromConfig,
  draftToLinks,
  invalidateRegionCuration,
  isDraftDirty,
  moveItem,
  regionSaveErrorMessage,
  removeItem,
  validateIntro,
  validateRegionDraft,
  type RegionCatalog,
} from './regionCurator';

jest.mock('@/services/supabase/client', () => ({ supabase: { from: jest.fn() } }));

const ROOT = path.join(__dirname, '../../..');
const MIGRATION = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260930000002_region_content_links.sql'), 'utf8');
const naryn = listRegionExperiences().find((config) => config.id === 'naryn')!;

const catalog: RegionCatalog = {
  destinationIds: new Set(['naryn', 'son-kol', 'ysyk-kol', 'tash-rabat']),
  discoveryRegion: new Map([
    ['naryn-shyrdak', 'naryn'],
    ['ysyk-kol-shore', 'ysyk-kol'],
  ]),
  cultureItemIds: new Set(['shyrdak']),
  materialIds: new Set(['felt']),
  trailIds: new Set(['t1']),
  questIds: new Set(['q1']),
  supportedRegionIds: new Set(listRegionExperiences().map((config) => config.id)),
};
const draft = { destinationIds: ['naryn', 'son-kol'], discoveryIds: ['naryn-shyrdak'], cultureItemIds: ['shyrdak'], materialIds: [], trailIds: [], questIds: ['q1'] };

describe('region curator - validation', () => {
  it('a valid draft has no problems', () => {
    expect(validateRegionDraft('naryn', draft, catalog)).toEqual([]);
  });

  it('rejects an unknown region outright', () => {
    expect(validateRegionDraft('bishkek', draft, catalog)).toEqual(['Unknown region: bishkek']);
  });

  it('reports broken links, duplicates, and a discovery from another region', () => {
    const problems = validateRegionDraft('naryn', { ...draft, destinationIds: ['naryn', 'nowhere', 'son-kol', 'son-kol'], discoveryIds: ['ysyk-kol-shore'], questIds: ['gone'] }, catalog);
    expect(problems).toEqual(
      expect.arrayContaining(['Places: duplicate entry.', 'Places: "nowhere" doesn\'t exist.', 'Discoveries: "ysyk-kol-shore" belongs to another region.', 'Guided quests: "gone" doesn\'t exist.']),
    );
  });

  it('a place already claimed by another region is blocked (a place belongs to one region)', () => {
    const other = { ...naryn, id: 'ysyk-kol', destinationIds: ['ysyk-kol', 'son-kol'] };
    expect(validateRegionDraft('naryn', draft, catalog, [other])).toContain('Places: "son-kol" is already in ysyk-kol.');
  });

  it('a type still loading is never reported broken', () => {
    expect(validateRegionDraft('naryn', { ...draft, cultureItemIds: ['anything'] }, { ...catalog, cultureItemIds: undefined })).toEqual([]);
  });

  it('the region itself must stay first', () => {
    expect(validateRegionDraft('naryn', { ...draft, destinationIds: ['son-kol', 'naryn'] }, catalog)).toContain('The region itself must stay the first place.');
  });
});

describe('region curator - ordering', () => {
  it('moves and removes, but never the locked first place', () => {
    const places = ['naryn', 'a', 'b'];
    expect(moveItem(places, 2, -1, true)).toEqual(['naryn', 'b', 'a']);
    expect(moveItem(places, 1, -1, true)).toEqual(places);
    expect(moveItem(places, 0, 1, true)).toEqual(places);
    expect(removeItem(places, 0, true)).toEqual(places);
    expect(removeItem(places, 1, true)).toEqual(['naryn', 'b']);
    expect(addItem(places, 'a')).toEqual(places);
  });

  it('saved rows carry per-type order and always put the region first', () => {
    const links = draftToLinks('naryn', { ...draft, destinationIds: ['son-kol', 'naryn'] });
    expect(links.filter((link) => link.content_type === 'destination')).toEqual([
      { content_type: 'destination', content_id: 'naryn', sort_order: 0 },
      { content_type: 'destination', content_id: 'son-kol', sort_order: 1 },
    ]);
  });

  it('round trip: saved rows resolve back to the same draft (order kept)', () => {
    const edited = { ...draftFromConfig(naryn), cultureItemIds: [...naryn.cultureItemIds].reverse() };
    const rows = draftToLinks('naryn', edited).map((link) => ({ ...link, region_id: 'naryn' }));
    const resolved = resolveRegionExperiences(rows).find((config) => config.id === 'naryn')!;
    expect(draftFromConfig(resolved)).toEqual(edited);
    expect(isDraftDirty(draftFromConfig(naryn), edited)).toBe(naryn.cultureItemIds.length > 1);
  });
});

describe('region curator - fallback and resolver', () => {
  it('no curated rows = built-in configs; one curated region does not change the others', () => {
    expect(resolveRegionExperiences(undefined)).toEqual(listRegionExperiences());
    expect(resolveRegionExperiences([])).toEqual(listRegionExperiences());
    const resolved = resolveRegionExperiences([{ region_id: 'naryn', content_type: 'culture_item', content_id: 'x', sort_order: 0 }]);
    const byId = Object.fromEntries(resolved.map((config) => [config.id, config]));
    expect(byId.naryn.cultureItemIds).toEqual(['x']);
    expect(byId.naryn.destinationIds).toEqual(['naryn']);
    expect(byId.naryn.challengeQuestionIds).toEqual(naryn.challengeQuestionIds);
    expect(byId.naryn.heroImage).toBe(naryn.heroImage);
    for (const config of listRegionExperiences().filter((config) => config.id !== 'naryn')) expect(byId[config.id]).toEqual(config);
    expect(resolved.map((config) => config.id)).toEqual(listRegionExperiences().map((config) => config.id));
  });

  it('backend without the table (migration not applied) -> [] (built-in links), never an error', async () => {
    const select = jest.fn(() => ({ order: jest.fn(async () => ({ data: null, error: { code: 'PGRST205' } })) }));
    (supabase.from as jest.Mock).mockReturnValue({ select });
    await expect(fetchRegionLinks()).resolves.toEqual([]);
    expect(select).toHaveBeenCalledWith(expect.not.stringContaining('updated_by'));
  });

  it('an intro override is per language, trimmed, and empty means built-in', () => {
    const rows = [{ region_id: 'naryn', language: 'ru' as const, intro: '  Нарын  ' }];
    expect(regionIntroOverride(rows, 'naryn', 'ru')).toBe('Нарын');
    expect(regionIntroOverride(rows, 'naryn', 'en')).toBeNull();
    expect(regionIntroOverride(undefined, 'naryn', 'ru')).toBeNull();
  });
});

describe('region curator - intros, errors, cache', () => {
  it('intro validation mirrors the database check', () => {
    expect(validateIntro('')).toBeNull();
    expect(validateIntro('Highland region.')).toBeNull();
    expect(validateIntro('x'.repeat(301))).toMatch(/300/);
    expect(validateIntro('<b>hi</b>')).toMatch(/Plain text/);
    expect(MIGRATION).toMatch(/char_length\(btrim\(intro\)\) between 1 and 300 and intro !~ '\[<>\{\}\]'/);
  });

  it('server errors become actionable messages', () => {
    expect(regionSaveErrorMessage({ message: 'NOT_AUTHORIZED' })).toMatch(/can't edit/);
    expect(regionSaveErrorMessage({ message: 'BROKEN_LINK: son-kol' })).toMatch(/son-kol/);
    expect(regionSaveErrorMessage({ message: 'DUPLICATE_LINK' })).toMatch(/twice/);
    expect(regionSaveErrorMessage({ message: 'UNKNOWN_REGION' })).toMatch(/not supported/);
  });

  it('a save invalidates the curated links and intros every screen reads', async () => {
    const invalidateQueries = jest.fn(async () => undefined);
    await invalidateRegionCuration({ invalidateQueries } as never);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['region_content_links'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['region_intros'] });
  });
});

describe('region curator - server authorization (static migration check)', () => {
  it('both writes require a content-editing role, validate, and are audited; no client write policy', () => {
    for (const fn of ['admin_set_region_links', 'admin_set_region_intro']) {
      const body = MIGRATION.slice(MIGRATION.indexOf(`function public.${fn}(`));
      expect(body.slice(0, 600)).toMatch(/security definer set search_path = public/);
      expect(body).toMatch(/require_admin_role\(array\['super_admin', 'content_editor'\]\)/);
      expect(MIGRATION).toMatch(new RegExp(`revoke execute on function public\\.${fn}\\([^)]*\\) from public, anon`));
    }
    expect(MIGRATION).toMatch(/UNKNOWN_REGION/);
    expect(MIGRATION).toMatch(/BROKEN_LINK/);
    expect(MIGRATION).toMatch(/DUPLICATE_LINK/);
    expect(MIGRATION.match(/insert into public\.admin_audit_log/g)).toHaveLength(2);
    expect(MIGRATION).not.toMatch(/for (insert|update|delete|all)/i);
    // Editor ids are not readable by the app.
    expect(MIGRATION).toMatch(/revoke select on public\.region_content_links from anon, authenticated/);
    expect(MIGRATION).not.toMatch(/grant select \([^)]*updated_by/);
  });
});
