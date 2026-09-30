import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { cultureItemImages, cultureMaterialImages } from '@/features/culture/data';
import { discoveryImages, natureSiteCoordinates } from '@/features/explore/data';
import { GUIDED_QUESTS } from '@/features/quests/questsData';
import { trails } from '@/features/trails/trailsData';

import { getRegionExperience, REGION_EXPERIENCES, regionHubRoute, type RegionExperienceConfig } from './regionExperiences';
import { buildRegionShareCard, computeRegionProgress, pickStartHere, regionMapHighlightIds, validateRegionExperience, type RegionSignals } from './regionModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const ROOT = path.join(__dirname, '../../../..');
const NONE: RegionSignals = { visitedRegionIds: [], discoveredIds: [], trails: {}, quests: {} };
const lookup = (dict: unknown, key: string) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict);

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
    for (const bad of ['', 'naryn', 'atlantis', undefined, null]) expect(getRegionExperience(bad)).toBeNull();
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
        cultureItemIds: new Set(Object.keys(cultureItemImages)),
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
