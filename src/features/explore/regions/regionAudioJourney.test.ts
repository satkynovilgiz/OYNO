import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { cultureItemNarration, placeNarration } from '@/services/audioGuide/contentNarration';
import type { CultureItemRow, CultureMaterialRow, ExploreRegionRow } from '@/services/content/types';

import { buildRegionAudioJourney, listenedCount, MIN_JOURNEY_STOPS, regionAudioRoute, resumeStopIndex } from './regionAudioJourney';
import { getRegionExperience } from './regionExperiences';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const naryn = { ...getRegionExperience('naryn')!, destinationIds: ['naryn', 'son-kol', 'tash-rabat'], cultureItemIds: ['shyrdak'], materialIds: ['felt-story'] };
const place = (id: string, facts: string[], factsTranslation?: string) =>
  ({ id, kind: 'nature', name_kg: `${id}-kg`, name_ru: `${id}-ru`, name_en: `${id}-en`, tagline: 'Тоолор', facts, factsTranslation }) as unknown as ExploreRegionRow;
const item = { id: 'shyrdak', title: 'Шырдак', history: 'Тарых', translation: { status: 'missing', titles: { kg: 'Шырдак' } } } as unknown as CultureItemRow;
const material = { id: 'felt-story', title: 'Кийиз', body: 'Кийиз жөнүндө.', translation: { status: 'missing', titles: { kg: 'Кийиз' } } } as unknown as CultureMaterialRow;
const content = { places: [place('naryn', ['Факт.']), place('son-kol', ['Көл.']), place('tash-rabat', [])], cultureItems: [item], materials: [material] };
const kgOptions = { language: 'kg' as const, depth: 'standard' as const, isChild: false };

describe('Regional Audio Journeys', () => {
  it('stops follow the region order: places, then culture items, then materials; empty stops skipped', () => {
    const journey = buildRegionAudioJourney(naryn, content, kgOptions)!;
    expect(journey.stops.map((stop) => stop.key)).toEqual(['region:naryn', 'region:son-kol', 'region:tash-rabat', 'culture_item:shyrdak', 'culture_material:felt-story']);
    expect(journey.stops.map((stop) => stop.route)).toEqual(['/explore/naryn', '/explore/son-kol', '/explore/tash-rabat', '/culture/item/shyrdak', '/culture/material/felt-story']);
  });

  it('each stop reads exactly what its own page reads', () => {
    const journey = buildRegionAudioJourney(naryn, content, kgOptions)!;
    expect(journey.stops[0].narration).toEqual(placeNarration({ name: { kg: 'naryn-kg', ru: 'naryn-ru', en: 'naryn-en' }, tagline: 'Тоолор', facts: ['Факт.'] }, 'kg', false));
    expect(journey.stops[3].narration).toEqual(cultureItemNarration(item, 'kg', 'standard'));
  });

  it('no journey below 3 meaningful stops (Kyrgyz-only text is not meaningful for RU/EN listeners)', () => {
    expect(MIN_JOURNEY_STOPS).toBe(3);
    expect(buildRegionAudioJourney(naryn, content, { ...kgOptions, language: 'en' })).toBeNull();
    expect(buildRegionAudioJourney({ ...naryn, destinationIds: ['naryn'], materialIds: [] }, content, kgOptions)).toBeNull();
    // A recording in the listener's language makes a stop meaningful.
    const recorded = buildRegionAudioJourney(naryn, content, { ...kgOptions, language: 'en', hasRecording: (key) => key.startsWith('region:') });
    expect(recorded?.stops.map((stop) => stop.key)).toEqual(['region:naryn', 'region:son-kol', 'region:tash-rabat']);
    // Translated facts are meaningful in that language.
    const translated = { ...content, places: content.places.map((row) => ({ ...row, factsTranslation: 'available' }) as ExploreRegionRow) };
    expect(buildRegionAudioJourney(naryn, translated, { ...kgOptions, language: 'ru' })?.stops).toHaveLength(3);
  });

  it('stop-level resume: saved stop, else first unheard, else first; removed stops ignored', () => {
    const journey = buildRegionAudioJourney(naryn, content, kgOptions)!;
    expect(resumeStopIndex(journey, undefined)).toBe(0);
    expect(resumeStopIndex(journey, { current: 'culture_item:shyrdak', listened: [] })).toBe(3);
    expect(resumeStopIndex(journey, { current: 'region:gone', listened: ['region:naryn'] })).toBe(1);
    expect(resumeStopIndex(journey, { current: null, listened: journey.stops.map((stop) => stop.key) })).toBe(0);
    expect(listenedCount(journey, { current: null, listened: ['region:naryn', 'region:gone'] })).toBe(1);
  });

  it('no auto-advance, no region progress, no rewards', () => {
    const screen = fs.readFileSync(path.join(__dirname, 'RegionAudioJourneyScreen.tsx'), 'utf8');
    const store = fs.readFileSync(path.join(__dirname, 'useRegionAudioJourneyStore.ts'), 'utf8');
    for (const source of [screen, store]) {
      expect(source).not.toMatch(/useProgressStore|visitExploreRegion|discover|addXp|addCoins|apply_reward|supabase/);
    }
    // Finishing a stop only marks it listened; moving on is the listener's tap.
    expect(screen).toMatch(/if \(finished && stop\) useRegionAudioJourneyStore\.getState\(\)\.markListened/);
    expect(screen).not.toMatch(/finished[^\n]*go\(index \+ 1\)/);
    expect(screen).not.toMatch(/\.start\(/);
  });

  it('route and KG/RU/EN strings', () => {
    expect(regionAudioRoute('naryn')).toBe('/explore/region/naryn/audio');
    expect(fs.existsSync(path.join(__dirname, '../../../app/explore/region/[id]/audio.tsx'))).toBe(true);
    const keys = ['title', 'stopOf', 'listened', 'previous', 'next', 'none', 'backToRegion', 'kind.destination', 'kind.culture_item', 'kind.culture_material', 'stops_other'];
    for (const dict of [kg, ru, en]) for (const key of keys) expect(key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], (dict as { regionHub: { audio: unknown } }).regionHub.audio)).toBeTruthy();
  });
});
