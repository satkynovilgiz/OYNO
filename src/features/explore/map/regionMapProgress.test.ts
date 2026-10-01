import * as fs from 'fs';
import * as path from 'path';

import { listRegionExperiences } from '@/features/explore/regions/regionExperiences';
import type { RegionSignals } from '@/features/explore/regions/regionModel';
import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import type { ExploreRegionRow } from '@/services/content/types';

import { ILLUSTRATED_MAP_COORDINATES, REGION_MAP_ANCHORS } from './illustratedMap';
import { buildRegionMapMarkers, canShowProgressMode } from './regionMapProgress';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const NONE: RegionSignals = { visitedRegionIds: [], discoveredIds: [], trails: {}, quests: {} };
const configs = listRegionExperiences();
const rows = configs.map((config) => ({ id: config.id, kind: 'region', name_kg: `${config.id}-kg`, name_ru: `${config.id}-ru`, name_en: `${config.id}-en` }) as unknown as ExploreRegionRow);
const screen = fs.readFileSync(path.join(__dirname, 'InteractiveMapScreen.tsx'), 'utf8');

describe('My Kyrgyzstan Map', () => {
  it('every Region Hub has an on-painting anchor; Bishkek (a city, not a hub) has none', () => {
    expect(Object.keys(REGION_MAP_ANCHORS).sort()).toEqual(configs.map((config) => config.id).sort());
    expect(REGION_MAP_ANCHORS.bishkek).toBeUndefined();
    for (const { xPercent, yPercent } of Object.values(REGION_MAP_ANCHORS)) {
      expect(xPercent).toBeGreaterThan(0);
      expect(xPercent).toBeLessThan(100);
      expect(yPercent).toBeGreaterThan(0);
      expect(yPercent).toBeLessThan(100);
    }
  });

  it('region markers keep clear of each other (no two anchors within 6% of the painting)', () => {
    const anchors = Object.values(REGION_MAP_ANCHORS);
    for (let i = 0; i < anchors.length; i++)
      for (let j = i + 1; j < anchors.length; j++) expect(Math.hypot(anchors[i].xPercent - anchors[j].xPercent, anchors[i].yPercent - anchors[j].yPercent)).toBeGreaterThan(6);
    // Place pins stay where they were.
    expect(ILLUSTRATED_MAP_COORDINATES['son-kol']).toEqual({ xPercent: 52.5, yPercent: 46.5 });
  });

  it('markers: one per region, in the one region order, same derived state as the Passport', () => {
    const markers = buildRegionMapMarkers(configs, rows, { ...NONE, visitedRegionIds: ['naryn', 'son-kol', 'osh'] }, 'en');
    expect(markers.map((marker) => marker.id)).toEqual(configs.map((config) => config.id));
    const byId = Object.fromEntries(markers.map((marker) => [marker.id, marker]));
    expect(byId.naryn.status).toBe('completed');
    expect(byId.osh.status).toBe('in_progress');
    expect(byId.talas.status).toBe('not_started');
    expect(byId.naryn.name).toBe('naryn-en');
    expect(byId.naryn.x).toBeCloseTo(REGION_MAP_ANCHORS.naryn.xPercent / 100);
  });

  it('a region without a loaded row is left out (never an unnamed marker)', () => {
    expect(buildRegionMapMarkers(configs, rows.slice(1), NONE, 'kg').map((marker) => marker.id)).not.toContain(configs[0].id);
  });

  it('?trail and ?region keep their focused view: the switch is only on the open map, Places by default', () => {
    expect(canShowProgressMode(undefined)).toBe(true);
    expect(canShowProgressMode(['son-kol'])).toBe(false);
    expect(screen).toMatch(/useState<MapMode>\('places'\)/);
    expect(screen).toMatch(/const progressMode = showModeSwitch && mode === 'progress'/);
  });

  it('no GPS, no borders, nothing recorded by looking', () => {
    const model = fs.readFileSync(path.join(__dirname, 'regionMapProgress.ts'), 'utf8');
    for (const source of [screen, model]) expect(source).not.toMatch(/expo-location|getCurrentPosition|watchPosition|Polygon|visitExploreRegion/);
    expect(screen).toMatch(/track\('map_region_progress_opened'/);
  });

  it('KG/RU/EN strings', () => {
    for (const dict of [kg, ru, en]) {
      const map = (dict as { explore: { map: Record<string, unknown> } }).explore.map;
      expect(map.modeLabel).toBeTruthy();
      expect(map.openRegion).toBeTruthy();
      expect((map.mode as Record<string, string>).places).toBeTruthy();
      expect((map.mode as Record<string, string>).progress).toBeTruthy();
    }
  });
});
