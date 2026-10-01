import * as fs from 'fs';
import * as path from 'path';

import { getRegionExperience, listRegionExperiences, regionTone } from '@/features/explore/regions/regionExperiences';
import { pickStartHere, type RegionSignals } from '@/features/explore/regions/regionModel';
import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import { pickContinueRegion } from './continueRegion';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const NONE: RegionSignals = { visitedRegionIds: [], discoveredIds: [], trails: {}, quests: {} };
const configs = listRegionExperiences();
const ALL_PLACES = configs.flatMap((config) => config.destinationIds);
const ALL_DISCOVERIES = configs.flatMap((config) => config.discoveryIds);
const lookup = (dict: unknown, key: string) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict);

describe('Home "Continue exploring"', () => {
  it('new user: "start" with the first region in the fixed order (no pretend history)', () => {
    const pick = pickContinueRegion(configs, NONE, {});
    expect(pick).toMatchObject({ kind: 'start', config: { id: 'chuy' }, next: { kind: 'destination', id: 'chuy' } });
  });

  it('one partial region is picked, with the hub’s own next activity', () => {
    const signals = { ...NONE, visitedRegionIds: ['naryn'] };
    const pick = pickContinueRegion(configs, signals, { naryn: '2026-09-29T10:00:00Z' });
    expect(pick).toMatchObject({ kind: 'continue', config: { id: 'naryn' }, progress: { completed: 1, total: 2 } });
    if (pick.kind !== 'allDone') expect(pick.next).toEqual(pickStartHere(getRegionExperience('naryn')!, signals));
    expect(pick.kind !== 'allDone' && pick.next).toEqual({ kind: 'destination', id: 'son-kol' });
  });

  it('several partial regions: the most recently visited wins; no dates -> region order', () => {
    const signals = { ...NONE, visitedRegionIds: ['naryn', 'jalal-abad'] };
    expect(pickContinueRegion(configs, signals, { naryn: '2026-09-20T10:00:00Z', 'jalal-abad': '2026-09-29T10:00:00Z' })).toMatchObject({ config: { id: 'jalal-abad' } });
    expect(pickContinueRegion(configs, signals, {})).toMatchObject({ config: { id: 'naryn' } });
  });

  it('completed regions are never recommended; with nothing in progress the next unstarted one is "continue"', () => {
    const pick = pickContinueRegion(configs, { ...NONE, visitedRegionIds: ['chuy'] }, { chuy: '2026-09-29T10:00:00Z' });
    expect(pick).toMatchObject({ kind: 'continue', config: { id: 'talas' } });
  });

  it('all completed -> "Kyrgyzstan explored"', () => {
    expect(pickContinueRegion(configs, { ...NONE, visitedRegionIds: ALL_PLACES, discoveredIds: ALL_DISCOVERIES }, {})).toEqual({ kind: 'allDone' });
  });

  it('account change: the pick follows whatever progress is loaded now (nothing cached)', () => {
    const accountA = pickContinueRegion(configs, { ...NONE, visitedRegionIds: ['osh'] }, { osh: '2026-09-29T10:00:00Z' });
    const accountB = pickContinueRegion(configs, NONE, {});
    expect(accountA).toMatchObject({ config: { id: 'osh' } });
    expect(accountB).toMatchObject({ kind: 'start', config: { id: 'chuy' } });
    const card = fs.readFileSync(path.join(__dirname, 'components/ContinueRegionCard.tsx'), 'utf8');
    expect(card).not.toMatch(/useState|useRef|AsyncStorage/);
  });

  it('image: hero when there is one, otherwise the region tone with the ornament', () => {
    expect(getRegionExperience('chuy')!.heroImage).toBeNull();
    expect(regionTone('chuy')).toBeTruthy();
    const card = fs.readFileSync(path.join(__dirname, 'components/ContinueRegionCard.tsx'), 'utf8');
    expect(card).toMatch(/pick\.config\.heroImage \? <Image[\s\S]*?: <OymoOrnament/);
  });

  it('KG/RU/EN strings exist; analytics carry only region id and next activity type', () => {
    for (const dict of [kg, ru, en]) for (const key of ['continue', 'start', 'next', 'cta', 'allDone', 'viewPassport']) expect(String(lookup(dict, `home.continueRegion.${key}`) ?? '').trim()).toBeTruthy();
    const card = fs.readFileSync(path.join(__dirname, 'components/ContinueRegionCard.tsx'), 'utf8');
    expect(card).toMatch(/track\('home_continue_region_opened', \{ region_id: target\.config\.id, next_activity_type: target\.next\.kind \}\)/);
  });
});
