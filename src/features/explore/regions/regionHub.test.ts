import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { cultureItemImages, cultureMaterialImages } from '@/features/culture/data';
import { discoveryImages, natureSiteCoordinates } from '@/features/explore/data';
import { GUIDED_QUESTS } from '@/features/quests/questsData';
import { trails } from '@/features/trails/trailsData';

import { getRegionExperience, listRegionExperiences, REGION_EXPERIENCES, regionForDestination, regionHubRoute, regionOwnImage, regionTone, type RegionExperienceConfig } from './regionExperiences';
import { buildRegionShareCard, computeRegionProgress, pickStartHere, regionMapHighlightIds, validateRegionExperience, type RegionSignals } from './regionModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const ROOT = path.join(__dirname, '../../../..');
const NONE: RegionSignals = { visitedRegionIds: [], discoveredIds: [], trails: {}, quests: {} };
const lookup = (dict: unknown, key: string) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict);

/** Culture item ids seeded by the migrations (the repo's content source). */
function seededCultureItemIds(): Set<string> {
  const dir = path.join(ROOT, 'supabase/migrations');
  const sql = fs.readdirSync(dir).map((file) => fs.readFileSync(path.join(dir, file), 'utf8')).join('\n');
  const ids = new Set<string>();
  for (const [, id] of sql.matchAll(/\(\s*'([a-z0-9-]+)',\s*'(?:boz-uy|oymo|shyrdak|komuz|music|clothing|horse|food|games|tradition)',/g)) ids.add(id);
  return ids;
}

/** discovery id -> region id, from the repo's seed migration (source of truth for the tie). */
function seededDiscoveryRegions(): Map<string, string | null> {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260901000002_explore_v2.sql'), 'utf8');
  const map = new Map<string, string | null>();
  for (const [, id, region] of sql.matchAll(/\('([a-z-]+)', (null|'[a-z-]+'), '(?:nature|culture|animals|food)'/g)) map.set(id, region === 'null' ? null : region.replace(/'/g, ''));
  return map;
}

describe('Region Hub - Issyk-Kul pilot', () => {
  const issykKul = getRegionExperience('ysyk-kol')!;

  it('resolves the pilot and rejects unknown/unsupported ids (Not Found)', () => {
    expect(issykKul.id).toBe('ysyk-kol');
    for (const bad of ['', 'bishkek', 'atlantis', undefined, null]) expect(getRegionExperience(bad)).toBeNull();
    expect(regionHubRoute('ysyk-kol')).toBe('/explore/region/ysyk-kol');
    expect(fs.existsSync(path.join(ROOT, 'src/app/explore/region/[id].tsx'))).toBe(true);
    expect(fs.readFileSync(path.join(__dirname, 'RegionHubScreen.tsx'), 'utf8')).toMatch(/if \(!config\) return <NotFoundState/);
  });

  it('links only content that exists and genuinely belongs to the region', () => {
    const regionIds = new Set(fs.readdirSync(path.join(ROOT, 'content/explore')).map((file) => file.replace(/\.md$/, '')));
    const discoveryRegion = seededDiscoveryRegions();
    expect(discoveryRegion.get('ysyk-kol-shore')).toBe('ysyk-kol');
    for (const config of Object.values(REGION_EXPERIENCES)) {
      const problems = validateRegionExperience(config, {
        regionIds,
        discoveryRegion,
        cultureItemIds: new Set([...seededCultureItemIds(), ...Object.keys(cultureItemImages)]),
        materialIds: new Set(Object.keys(cultureMaterialImages)),
        trailIds: new Set(trails.map((trail) => trail.id)),
        questIds: new Set(GUIDED_QUESTS.map((quest) => quest.id)),
      });
      expect(problems).toEqual([]);
    }
    expect(discoveryImages['ysyk-kol-shore']).toBeTruthy();
  });

  it('the validator catches duplicates, missing ids and borrowed content', () => {
    const bad: RegionExperienceConfig = { ...issykKul, destinationIds: ['ysyk-kol', 'ysyk-kol', 'atlantis'], discoveryIds: ['boz-uy'], trailIds: ['ghost'] };
    const problems = validateRegionExperience(bad, { regionIds: new Set(['ysyk-kol']), discoveryRegion: seededDiscoveryRegions(), cultureItemIds: new Set(), materialIds: new Set(), trailIds: new Set(), questIds: new Set() });
    expect(problems).toEqual(expect.arrayContaining(['duplicate destination ids', 'destination atlantis missing', 'discovery boz-uy belongs to another region', 'trail ghost missing']));
  });

  it('progress counts explicit actions only, with a real denominator', () => {
    expect(computeRegionProgress(issykKul, NONE)).toMatchObject({ completed: 0, total: 2, percent: 0 });
    expect(computeRegionProgress(issykKul, { ...NONE, visitedRegionIds: ['ysyk-kol'] })).toMatchObject({ completed: 1, total: 2, percent: 50, places: { visited: 1, total: 1 } });
    expect(computeRegionProgress(issykKul, { ...NONE, visitedRegionIds: ['ysyk-kol', 'naryn'], discoveredIds: ['ysyk-kol-shore', 'boz-uy'] })).toMatchObject({ completed: 2, total: 2, percent: 100 });
  });

  it('trail stops and guided quest steps join the denominator when a region links them', () => {
    const withMore = { ...issykKul, trailIds: ['t'], questIds: ['q'] };
    const signals = { ...NONE, trails: { t: { completed: 1, total: 3 } }, quests: { q: { completed: 0, total: 4 } } };
    expect(computeRegionProgress(withMore, signals)).toMatchObject({ completed: 1, total: 9 });
  });

  it('Start here: unvisited place -> unfound discovery -> trail -> quest -> done', () => {
    expect(pickStartHere(issykKul, NONE)).toEqual({ kind: 'destination', id: 'ysyk-kol' });
    expect(pickStartHere(issykKul, { ...NONE, visitedRegionIds: ['ysyk-kol'] })).toEqual({ kind: 'discovery', id: 'ysyk-kol-shore', destinationId: 'ysyk-kol' });
    const done = { ...NONE, visitedRegionIds: ['ysyk-kol'], discoveredIds: ['ysyk-kol-shore'] };
    expect(pickStartHere(issykKul, done)).toEqual({ kind: 'done' });
    const withMore = { ...issykKul, trailIds: ['t'], questIds: ['q'] };
    expect(pickStartHere(withMore, { ...done, trails: { t: { completed: 1, total: 2 } }, quests: { q: { completed: 0, total: 3 } } })).toEqual({ kind: 'trail', id: 't' });
    expect(pickStartHere(withMore, { ...done, trails: { t: { completed: 2, total: 2 } }, quests: { q: { completed: 0, total: 3 } } })).toEqual({ kind: 'quest', id: 'q' });
  });

  it('map highlight = only the region places the map actually pins (none for Issyk-Kul today)', () => {
    const mapPlaces = Object.keys(natureSiteCoordinates);
    expect(regionMapHighlightIds(issykKul, mapPlaces)).toEqual([]);
    expect(regionMapHighlightIds({ ...issykKul, destinationIds: ['ysyk-kol', 'son-kol'] }, mapPlaces)).toEqual(['son-kol']);
    const route = fs.readFileSync(path.join(ROOT, 'src/app/explore/map.tsx'), 'utf8');
    expect(route).toMatch(/regionHighlights\.length > 0 \? regionHighlights : undefined/);
  });

  it('share card: hero, name, progress line, OYNO - no private data', () => {
    const card = buildRegionShareCard({ name: 'Ысык-Көл', label: 'Аймак', progressLine: '2 ичинен 1 ачылды', imageSource: issykKul.heroImage, fallbackTone: '#2F5233' });
    expect(card).toEqual({ title: 'Ысык-Көл', label: 'Аймак', subtitle: '2 ичинен 1 ачылды', imageSource: issykKul.heroImage, fallbackTone: '#2F5233' });
    expect(JSON.stringify(card)).not.toMatch(/@|ysyk-kol|\d{4}-\d{2}/);
  });

  it('every hub string exists in KG/RU/EN, including each region intro and the companion line', () => {
    const keys = ['regionHub.kicker', 'regionHub.progress', 'regionHub.startHere', 'regionHub.start.destination', 'regionHub.start.discovery', 'regionHub.start.done', 'regionHub.start.doneTitle', 'regionHub.sections.places', 'regionHub.sections.discoveries', 'regionHub.showOnMap', 'regionHub.shareLabel', 'regionHub.openRegion', 'companion.lines.region.intro'];
    for (const id of Object.keys(REGION_EXPERIENCES)) keys.push(`regionHub.regions.${id}.intro`);
    for (const dict of [kg, ru, en]) for (const key of keys) expect(String(lookup(dict, key) ?? '').trim()).toBeTruthy();
  });

  it('the intro makes no unsourced factual claims (depth, size, rank, dates)', () => {
    for (const dict of [kg, ru, en]) {
      const intro = String(lookup(dict, 'regionHub.regions.ysyk-kol.intro'));
      expect(intro).not.toMatch(/\d|largest|deepest|крупн|глубочайш|эң чоң|эң терең/i);
    }
  });
});

describe('Region Hub - all supported regions', () => {
  const EXPECTED = ['chuy', 'talas', 'ysyk-kol', 'naryn', 'jalal-abad', 'osh', 'batken'];

  it('supports exactly the seven oblast regions, in one fixed north-to-south order; Bishkek has no hub', () => {
    expect(listRegionExperiences().map((config) => config.id)).toEqual(EXPECTED);
    for (const id of EXPECTED) expect(getRegionExperience(id)?.id).toBe(id);
    expect(getRegionExperience('bishkek')).toBeNull();
    expect(regionForDestination('bishkek')).toBeNull();
  });

  it('the seeded catalog really contains the linked Naryn culture item', () => {
    expect(seededCultureItemIds().has('shyrdak-at-bashy')).toBe(true);
  });

  it('progress denominators per region (explicit actions only)', () => {
    const totals = Object.fromEntries(listRegionExperiences().map((config) => [config.id, computeRegionProgress(config, NONE).total]));
    expect(totals).toEqual({ chuy: 1, talas: 1, 'ysyk-kol': 2, naryn: 2, 'jalal-abad': 3, osh: 2, batken: 1 });
  });

  it('Start here walks each region in its fixed order', () => {
    const jalalAbad = getRegionExperience('jalal-abad')!;
    expect(pickStartHere(jalalAbad, NONE)).toEqual({ kind: 'destination', id: 'jalal-abad' });
    expect(pickStartHere(jalalAbad, { ...NONE, visitedRegionIds: ['jalal-abad'] })).toEqual({ kind: 'destination', id: 'sary-chelek' });
    expect(pickStartHere(jalalAbad, { ...NONE, visitedRegionIds: ['jalal-abad', 'sary-chelek', 'arslanbob'] })).toEqual({ kind: 'done' });
    expect(pickStartHere(getRegionExperience('batken')!, { ...NONE, visitedRegionIds: ['batken'] })).toEqual({ kind: 'done' });
  });

  it('map highlight ids per region = its pinned member places only', () => {
    const mapPlaces = Object.keys(natureSiteCoordinates);
    const highlights = Object.fromEntries(listRegionExperiences().map((config) => [config.id, regionMapHighlightIds(config, mapPlaces)]));
    expect(highlights).toEqual({ chuy: [], talas: [], 'ysyk-kol': [], naryn: ['son-kol'], 'jalal-abad': ['sary-chelek', 'arslanbob'], osh: ['alay'], batken: [] });
  });

  it('no destination, discovery or culture item is claimed by two regions; every member links back to its one region', () => {
    for (const key of ['destinationIds', 'discoveryIds', 'cultureItemIds'] as const) {
      const all = listRegionExperiences().flatMap((config) => config[key]);
      expect(new Set(all).size).toBe(all.length);
    }
    expect(regionForDestination('son-kol')?.id).toBe('naryn');
    expect(regionForDestination('alay')?.id).toBe('osh');
    expect(regionForDestination('arslanbob')?.id).toBe('jalal-abad');
    // Not linked on purpose: no sourced oblast / spans several regions.
    expect(regionForDestination('suusamyr')).toBeNull();
    expect(regionForDestination('ala-too')).toBeNull();
  });

  it('heroes: no photo reused between regions; photo-less regions get distinct tones; a region card never borrows a member photo', () => {
    const photos = listRegionExperiences().map((config) => config.heroImage).filter(Boolean);
    expect(new Set(photos).size).toBe(photos.length);
    const toneless = listRegionExperiences().filter((config) => !config.heroImage).map((config) => regionTone(config.id));
    expect(new Set(toneless).size).toBe(toneless.length);
    expect(regionOwnImage(getRegionExperience('naryn')!)).toBeNull();
    expect(regionOwnImage(getRegionExperience('ysyk-kol')!)).toBe(discoveryImages['ysyk-kol-shore']);
  });

  it('every region has a KG/RU/EN intro with no unsourced superlatives, figures or dates', () => {
    for (const id of EXPECTED) {
      for (const dict of [kg, ru, en]) {
        const intro = String(lookup(dict, `regionHub.regions.${id}.intro`) ?? '');
        expect(intro.trim()).toBeTruthy();
        expect(intro).not.toMatch(/\d|largest|oldest|most famous|birthplace|unique|крупн|древн|самы|уникальн|эң чоң|эң байыркы|мекени/i);
      }
    }
  });

  it('share card per region uses its name, progress line and hero or tone', () => {
    for (const config of listRegionExperiences()) {
      const card = buildRegionShareCard({ name: config.id, label: 'Region', progressLine: '0 / 1', imageSource: config.heroImage, fallbackTone: regionTone(config.id) });
      expect(card.subtitle).toBe('0 / 1');
      expect(card.imageSource ?? card.fallbackTone).toBeTruthy();
    }
  });
});

