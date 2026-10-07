import AsyncStorage from '@react-native-async-storage/async-storage';
import * as fs from 'fs';
import * as path from 'path';

import { seededRng } from '@/features/detective/detectiveModel';
import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { MAP_CHALLENGE_KEY, ownerMapChallenge, useMapChallengeStore } from '@/store/useMapChallengeStore';

import { ILLUSTRATED_MAP_ASPECT } from '../map/illustratedMap';
import { LABEL_MASKS, MAP_QUESTIONS, markersFor, PLACE_MARKERS, REGION_MARKERS, targetRoute } from './mapChallengeData';
import { buildMapSession, mapFinished, mapReducer, mapSummary, markerAt, SESSION_LENGTH, startMapSession, toPercent } from './mapChallengeModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const root = path.join(__dirname, '../../../..');
const verified = JSON.parse(fs.readFileSync(path.join(root, 'content/translations/explore_facts_batch1.json'), 'utf8')) as Record<string, { en: string[]; ru: string[] }>;
const seed = fs.readFileSync(path.join(root, 'supabase/migrations/20260824000001_content.sql'), 'utf8');
type Section = { names: Record<string, string>; facts: Record<string, Record<string, string>> };
const sections = { en: (en as unknown as { mapChallenge: Section }).mapChallenge, ru: (ru as unknown as { mapChallenge: Section }).mapChallenge, kg: (kg as unknown as { mapChallenge: Section }).mapChallenge };

describe('content: only verified data', () => {
  it('every question is about a destination whose facts hold no claim awaiting verification', () => {
    for (const question of MAP_QUESTIONS) expect([question.targetId, !!verified[question.targetId]]).toEqual([question.targetId, true]);
    // Not asked: regions whose facts are not verified yet.
    for (const unverified of ['talas', 'ysyk-kol', 'batken']) expect(MAP_QUESTIONS.some((question) => question.targetId === unverified)).toBe(false);
  });

  it('explanations restate the row facts exactly (RU/EN reviewed; KG source rows, corrected spelling)', () => {
    for (const question of MAP_QUESTIONS) {
      for (const index of question.factIndexes) {
        expect(sections.en.facts[question.id][`fact${index}`]).toBe(verified[question.targetId].en[index]);
        expect(sections.ru.facts[question.id][`fact${index}`]).toBe(verified[question.targetId].ru[index]);
        const kgFact = sections.kg.facts[question.id][`fact${index}`];
        // The seed has "Сон-Көл"; 20260926000001 corrected it to "Соң-Көл".
        expect(seed).toContain(kgFact.replace('Соң-Көл', 'Сон-Көл'));
      }
    }
  });

  it('names come from the rows, in all three languages, for every marker', () => {
    for (const marker of [...REGION_MARKERS, ...PLACE_MARKERS]) {
      for (const section of Object.values(sections)) expect([marker.id, !!section.names[marker.id]]).toEqual([marker.id, true]);
      expect(seed).toContain(`('${marker.id}', '${marker.layer === 'regions' ? 'region' : 'nature'}', '`);
      expect(seed).toContain(`'${sections.en.names[marker.id]}'`);
    }
  });

  it('targets are markers of their layer; regions open the Region Hub, places their page', () => {
    for (const question of MAP_QUESTIONS) expect(markersFor(question.layer).some((marker) => marker.id === question.targetId)).toBe(true);
    expect(targetRoute(MAP_QUESTIONS[0])).toBe('/explore/region/chuy');
    expect(targetRoute(MAP_QUESTIONS.find((question) => question.id === 'suusamyr')!)).toBe('/explore/suusamyr');
  });

  it('label covers stay inside the art', () => {
    for (const mask of LABEL_MASKS) {
      expect(mask.left + mask.width).toBeLessThanOrEqual(100);
      expect(mask.top + mask.height).toBeLessThanOrEqual(100);
    }
  });
});

describe('selection is accurate on every screen size', () => {
  const widths = [320, 375, 414, 768, 1024, 1440];
  it.each(widths)('at %ipx wide, tapping on (or near) a marker selects exactly that marker', (width) => {
    const height = width / ILLUSTRATED_MAP_ASPECT;
    for (const layer of ['regions', 'places'] as const) {
      const markers = markersFor(layer);
      for (const marker of markers) {
        const x = (marker.at.xPercent / 100) * width;
        const y = (marker.at.yPercent / 100) * height;
        expect(markerAt(toPercent(x, y, width, height), markers, ILLUSTRATED_MAP_ASPECT)?.id).toBe(marker.id);
        // A small miss (1.5% of the width) still lands on it.
        expect(markerAt(toPercent(x + width * 0.015, y - width * 0.01, width, height), markers, ILLUSTRATED_MAP_ASPECT)?.id).toBe(marker.id);
      }
      // Far from every marker: nothing is chosen.
      expect(markerAt(toPercent(width * 0.97, height * 0.95, width, height), markers, ILLUSTRATED_MAP_ASPECT)).toBeNull();
    }
  });

  it('the same physical tap gives the same answer at every size', () => {
    const point = { xPercent: 52, yPercent: 47 };
    expect(new Set(widths.map(() => markerAt(point, PLACE_MARKERS, ILLUSTRATED_MAP_ASPECT)?.id)).size).toBe(1);
    expect(markerAt(point, PLACE_MARKERS, ILLUSTRATED_MAP_ASPECT)?.id).toBe('son-kol');
  });
});

describe('session', () => {
  it('five different questions, for many seeds', () => {
    for (let s = 1; s <= 200; s += 1) {
      const questions = buildMapSession(seededRng(s));
      expect(questions).toHaveLength(SESSION_LENGTH);
      expect(new Set(questions.map((question) => question.id)).size).toBe(SESSION_LENGTH);
    }
  });

  it('scores correct picks, keeps mistakes, ignores double taps and markers of the other layer', () => {
    let state = startMapSession(buildMapSession(seededRng(9)));
    for (let index = 0; index < state.questions.length; index += 1) {
      const question = state.questions[index];
      const wrong = markersFor(question.layer).find((marker) => marker.id !== question.targetId)!.id;
      const otherLayer = markersFor(question.layer === 'regions' ? 'places' : 'regions')[0].id;
      expect(mapReducer(state, { type: 'choose', markerId: otherLayer })).toBe(state);
      expect(mapReducer(state, { type: 'next' })).toBe(state);
      state = mapReducer(state, { type: 'choose', markerId: index % 2 === 0 ? question.targetId : wrong });
      expect(mapReducer(state, { type: 'choose', markerId: question.targetId })).toBe(state);
      state = mapReducer(state, { type: 'next' });
    }
    expect(mapFinished(state)).toBe(true);
    const summary = mapSummary(state);
    expect(summary).toMatchObject({ correct: 3, total: 5 });
    expect(summary.mistakes.map((mistake) => mistake.questionId)).toEqual([state.questions[1].id, state.questions[3].id]);
  });

  it('practising mistakes asks only those', () => {
    expect(buildMapSession(seededRng(2), { onlyIds: ['naryn', 'osh'] }).map((question) => question.id).sort()).toEqual(['naryn', 'osh']);
  });
});

describe('playing is not visiting', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useMapChallengeStore.setState({ saved: {}, isLoaded: true });
  });

  it('results go to their own per-owner key only', async () => {
    useMapChallengeStore.getState().recordSession('guest', { correct: 4, missedIds: ['naryn'] });
    expect(ownerMapChallenge(useMapChallengeStore.getState().saved, 'guest')).toEqual({ best: 4, sessions: 1, lastMissedIds: ['naryn'] });
    expect(ownerMapChallenge(useMapChallengeStore.getState().saved, 'user-b').sessions).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await AsyncStorage.getAllKeys()).filter((key) => key !== MAP_CHALLENGE_KEY)).toEqual([]);
    for (const file of ['MapChallengeScreen.tsx', 'mapChallengeModel.ts', 'mapChallengeData.ts']) {
      expect(fs.readFileSync(path.join(__dirname, file), 'utf8')).not.toMatch(/useProgressStore|regionVisitDates|recordVisit|useDiscoveryPassport|useDailyDiscoveryStore|useGameRecordsStore/);
    }
  });
});
