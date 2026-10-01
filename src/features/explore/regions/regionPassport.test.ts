import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import { getRegionExperience, listRegionExperiences, regionTone } from './regionExperiences';
import { buildRegionShareCard, computeRegionProgress, newlyCompletedRegions, regionStatus, regionSummary, type RegionSignals } from './regionModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const NONE: RegionSignals = { visitedRegionIds: [], discoveredIds: [], trails: {}, quests: {} };
const lookup = (dict: unknown, key: string) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict);

describe('Regional Passport', () => {
  it('states: nothing done = not started, some = in progress, all = completed; total 0 never completes', () => {
    expect(regionStatus({ completed: 0, total: 2 })).toBe('not_started');
    expect(regionStatus({ completed: 1, total: 2 })).toBe('in_progress');
    expect(regionStatus({ completed: 2, total: 2 })).toBe('completed');
    expect(regionStatus({ completed: 0, total: 0 })).toBe('not_started');
  });

  it('opening a region page alone never completes a region with more to do', () => {
    const naryn = getRegionExperience('naryn')!;
    expect(regionStatus(computeRegionProgress(naryn, { ...NONE, visitedRegionIds: ['naryn'] }))).toBe('in_progress');
    expect(regionStatus(computeRegionProgress(naryn, { ...NONE, visitedRegionIds: ['naryn', 'son-kol'] }))).toBe('completed');
  });

  it('summary: started X / 7 and completed Y / 7 (started includes completed)', () => {
    const configs = listRegionExperiences();
    expect(regionSummary(configs, NONE)).toEqual({ started: 0, completed: 0, total: 7 });
    const signals = { ...NONE, visitedRegionIds: ['chuy', 'naryn', 'jalal-abad'] };
    expect(regionSummary(configs, signals)).toEqual({ started: 3, completed: 1, total: 7 });
  });

  it('derived, not stored: another device with the same synced visits gets the same result', () => {
    const synced = { ...NONE, visitedRegionIds: ['osh', 'alay', 'batken'] };
    const deviceA = listRegionExperiences().map((config) => regionStatus(computeRegionProgress(config, synced)));
    const deviceB = listRegionExperiences().map((config) => regionStatus(computeRegionProgress(config, { ...synced, visitedRegionIds: [...synced.visitedRegionIds] })));
    expect(deviceA).toEqual(deviceB);
    expect(deviceA.filter((status) => status === 'completed')).toHaveLength(2);
    const section = fs.readFileSync(path.join(__dirname, '../../journey/components/RegionsJourneySection.tsx'), 'utf8');
    expect(section).not.toMatch(/AsyncStorage|setItem|supabase/);
  });

  it('one region order everywhere: every region surface reads the one resolved model (static order, curated links)', () => {
    const ids = listRegionExperiences().map((config) => config.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const file of ['RegionRail.tsx', '../../journey/components/RegionsJourneySection.tsx', 'RegionCompletionWatcher.tsx', '../../home/components/ContinueRegionCard.tsx', 'useRegionSignals.ts']) {
      expect(fs.readFileSync(path.join(__dirname, file), 'utf8')).toMatch(/useRegionExperiences\(\)/);
    }
    // The resolver keeps the static order whatever the editors saved.
    const hook = fs.readFileSync(path.join(__dirname, 'useRegionExperiences.ts'), 'utf8');
    expect(hook).toMatch(/resolveRegionExperiences\(links\)/);
  });

  it('completion moment: only a change to completed, never on the first look (start / account change)', () => {
    expect(newlyCompletedRegions(null, { naryn: 'completed' })).toEqual([]);
    expect(newlyCompletedRegions({ naryn: 'in_progress', osh: 'completed' }, { naryn: 'completed', osh: 'completed' })).toEqual(['naryn']);
    expect(newlyCompletedRegions({ naryn: 'completed' }, { naryn: 'completed' })).toEqual([]);
  });

  it('share card: region name, "Completed", hero or tone - no account data', () => {
    const naryn = getRegionExperience('naryn')!;
    const card = buildRegionShareCard({ name: 'Нарын', label: 'Аймак', progressLine: 'Бүттү', imageSource: naryn.heroImage, fallbackTone: regionTone('naryn') });
    expect(card).toMatchObject({ title: 'Нарын', subtitle: 'Бүттү' });
    expect(JSON.stringify(card)).not.toMatch(/@|user|\d{4}-\d{2}/);
  });

  it('no reward: the Passport section and the watcher grant nothing', () => {
    for (const file of ['../../journey/components/RegionsJourneySection.tsx', 'RegionCompletionWatcher.tsx']) {
      expect(fs.readFileSync(path.join(__dirname, file), 'utf8')).not.toMatch(/apply_reward|addXp\(|addCoins|awardAchievement|claimGuidedQuest/);
    }
  });

  it('KG/RU/EN strings exist', () => {
    const keys = ['journey.regions.title', 'journey.regions.started', 'journey.regions.completedCount', 'journey.regions.share', 'journey.regions.explored', 'journey.regions.a11yName', 'journey.regions.state.not_started', 'journey.regions.state.in_progress', 'journey.regions.state.completed'];
    for (const dict of [kg, ru, en]) for (const key of keys) expect(String(lookup(dict, key) ?? '').trim()).toBeTruthy();
  });
});
