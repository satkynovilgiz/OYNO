import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import type { ExploreRegionRow } from '@/services/content/types';

import { getRegionExperience, listRegionExperiences } from './regionExperiences';
import { computeRegionProgress, type RegionSignals } from './regionModel';
import { buildRegionRailItems } from './regionRailItems';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const NONE: RegionSignals = { visitedRegionIds: [], discoveredIds: [], trails: {}, quests: {} };
const row = (id: string, kind: 'region' | 'nature', kgName: string, ruName: string, enName: string) => ({ id, kind, name_kg: kgName, name_ru: ruName, name_en: enName, tagline: '', facts: [], status: 'verified', sort_order: 0 }) as unknown as ExploreRegionRow;
const ROWS = [
  row('bishkek', 'region', 'Бишкек', 'Бишкек', 'Bishkek'),
  row('ysyk-kol', 'region', 'Ысык-Көл', 'Иссык-Куль', 'Issyk-Kul'),
  row('batken', 'region', 'Баткен', 'Баткен', 'Batken'),
  row('chuy', 'region', 'Чүй', 'Чуй', 'Chüy'),
  row('son-kol', 'nature', 'Соң-Көл', 'Сон-Куль', 'Son-Köl'),
  row('naryn', 'region', 'Нарын', 'Нарын', 'Naryn'),
  row('talas', 'region', 'Талас', 'Талас', 'Talas'),
  row('osh', 'region', 'Ош', 'Ош', 'Osh'),
  row('jalal-abad', 'region', 'Жалал-Абад', 'Джалал-Абад', 'Jalal-Abad'),
];
const lookup = (dict: unknown, key: string) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict);

describe('Explore by region rail', () => {
  it('shows only supported Region Hubs, once each, in the one fixed order (Bishkek and nature sites excluded)', () => {
    const items = buildRegionRailItems(ROWS, 'kg', NONE);
    expect(items.map((item) => item.id)).toEqual(listRegionExperiences().map((config) => config.id));
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    expect(items.map((item) => item.id)).not.toContain('bishkek');
    expect(items.map((item) => item.id)).not.toContain('son-kol');
  });

  it('builds the hub route', () => {
    expect(buildRegionRailItems(ROWS, 'en', NONE).find((item) => item.id === 'osh')?.route).toBe('/explore/region/osh');
  });

  it('uses the SAME progress model as the hub', () => {
    const signals = { ...NONE, visitedRegionIds: ['jalal-abad', 'sary-chelek'] };
    const item = buildRegionRailItems(ROWS, 'en', signals).find((entry) => entry.id === 'jalal-abad')!;
    expect(item.progress).toEqual(computeRegionProgress(getRegionExperience('jalal-abad')!, signals));
    expect(item.progress).toMatchObject({ completed: 2, total: 3 });
    expect(item.completed).toBe(false);
  });

  it('completed only when every counted action is done', () => {
    const done = buildRegionRailItems(ROWS, 'en', { ...NONE, visitedRegionIds: ['ysyk-kol'], discoveredIds: ['ysyk-kol-shore'] }).find((item) => item.id === 'ysyk-kol')!;
    expect(done.completed).toBe(true);
    expect(buildRegionRailItems(ROWS, 'en', { ...NONE, visitedRegionIds: ['ysyk-kol'] }).find((item) => item.id === 'ysyk-kol')!.completed).toBe(false);
  });

  it('localized names come from the content rows', () => {
    expect(buildRegionRailItems(ROWS, 'ru', NONE).find((item) => item.id === 'ysyk-kol')?.name).toBe('Иссык-Куль');
    expect(buildRegionRailItems(ROWS, 'kg', NONE).find((item) => item.id === 'ysyk-kol')?.name).toBe('Ысык-Көл');
    expect(buildRegionRailItems(ROWS, 'en', NONE).find((item) => item.id === 'jalal-abad')?.name).toBe('Jalal-Abad');
  });

  it('a region whose row is not loaded is skipped, never shown nameless; no rows -> no section', () => {
    expect(buildRegionRailItems(ROWS.filter((entry) => entry.id !== 'talas'), 'en', NONE).map((item) => item.id)).not.toContain('talas');
    expect(buildRegionRailItems([], 'en', NONE)).toEqual([]);
    expect(fs.readFileSync(path.join(__dirname, 'RegionRail.tsx'), 'utf8')).toMatch(/if \(items\.length === 0\) return null;/);
  });

  it('strings exist in KG/RU/EN and the completed state is text, not colour only', () => {
    for (const dict of [kg, ru, en]) for (const key of ['explore.regions.title', 'explore.regions.completed', 'regionHub.progress']) expect(String(lookup(dict, key) ?? '').trim()).toBeTruthy();
    expect(fs.readFileSync(path.join(__dirname, 'RegionRail.tsx'), 'utf8')).toMatch(/✓ \$\{t\('explore\.regions\.completed'\)\}/);
  });
});
