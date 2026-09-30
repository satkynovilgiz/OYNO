import * as fs from 'fs';
import * as path from 'path';

import { getRegionExperience, listRegionExperiences } from '@/features/explore/regions/regionExperiences';
import { computeRegionProgress } from '@/features/explore/regions/regionModel';
import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { recordCompletion } from '@/store/useChallengeStore';

import { validateQuestion } from './challengeLogic';
import { getQuestion } from './questionBank';
import { MIN_REGIONAL_QUESTIONS, regionalChallengeId, regionalChallengeQuestionIds, regionalQuestionProblem, regionalResultKey, regionForChallengeId } from './regionalChallenges';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const ROOT = path.join(__dirname, '../../..');
const lookup = (dict: unknown, key: string) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict);

describe('Regional Challenges 1.0', () => {
  it('only regions with enough trustworthy content get a challenge (Naryn, Jalal-Abad, Osh)', () => {
    const available = Object.fromEntries(listRegionExperiences().map((config) => [config.id, regionalChallengeQuestionIds(config).length]));
    expect(available).toEqual({ chuy: 0, talas: 0, 'ysyk-kol': 0, naryn: 3, 'jalal-abad': 3, osh: 3, batken: 0 });
  });

  it('every listed question exists and is sourced from content linked to THAT region', () => {
    for (const config of listRegionExperiences()) {
      for (const id of config.challengeQuestionIds ?? []) expect(regionalQuestionProblem(config, id)).toBeNull();
    }
  });

  it('rejects borrowed, flagged or missing questions, and a pack below the minimum shows nothing', () => {
    const osh = getRegionExperience('osh')!;
    expect(regionalQuestionProblem(osh, 'naryn-lakes')).toMatch(/not linked to osh/);
    expect(regionalQuestionProblem(osh, 'lenin-peak')).toMatch(/under review/);
    expect(regionalQuestionProblem(osh, 'no-such-question')).toMatch(/not in the question bank/);
    expect(regionalChallengeQuestionIds({ ...osh, challengeQuestionIds: ['osh-fergana', 'osh-alai', 'lenin-peak'] })).toEqual([]);
    expect(MIN_REGIONAL_QUESTIONS).toBe(3);
  });

  it('each question has exactly one valid correct answer and no duplicate options', () => {
    for (const config of listRegionExperiences()) {
      for (const id of regionalChallengeQuestionIds(config)) {
        const question = getQuestion(id)!;
        expect(validateQuestion(question)).toEqual([]);
        expect(question.options.map((option) => option.id)).toContain(question.correctOptionId);
        expect(new Set(question.options.map((option) => option.id)).size).toBe(question.options.length);
      }
    }
  });

  it('KG, RU and EN are complete - question, explanation and every option - with no duplicate option text', () => {
    for (const config of listRegionExperiences()) {
      for (const id of regionalChallengeQuestionIds(config)) {
        const question = getQuestion(id)!;
        for (const dict of [kg, ru, en]) {
          expect(String(lookup(dict, `challenges.questions.${id}.question`) ?? '').trim()).toBeTruthy();
          expect(String(lookup(dict, `challenges.questions.${id}.explanation`) ?? '').trim()).toBeTruthy();
          if (question.kind === 'multiple') {
            const labels = question.options.map((option) => String(lookup(dict, `challenges.questions.${id}.options.${option.id}`) ?? '').trim());
            expect(labels.every(Boolean)).toBe(true);
            expect(new Set(labels).size).toBe(labels.length);
          }
        }
      }
    }
  });

  it('no superlatives, rankings or population figures in the questions', () => {
    for (const config of listRegionExperiences()) {
      for (const id of regionalChallengeQuestionIds(config)) {
        for (const dict of [kg, ru, en]) expect(String(lookup(dict, `challenges.questions.${id}.question`))).not.toMatch(/largest|oldest|deepest|second|population|крупн|древн|глубоч|населен|эң чоң|эң терең|калк/i);
      }
    }
  });

  it('challenge <-> region navigation: id, route guard, back to the hub without a loop', () => {
    expect(regionalChallengeId('naryn')).toBe('region-naryn');
    expect(regionForChallengeId('region-naryn')?.id).toBe('naryn');
    expect(regionForChallengeId('region-chuy')).toBeNull();
    expect(regionForChallengeId('region-atlantis')).toBeNull();
    expect(fs.readFileSync(path.join(ROOT, 'src/app/challenges/[challengeId].tsx'), 'utf8')).toMatch(/if \(challengeId\.startsWith\('region-'\)\) return !!regionForChallengeId\(challengeId\);/);
    expect(fs.readFileSync(path.join(__dirname, 'ChallengeRunScreen.tsx'), 'utf8')).toMatch(/router\.canGoBack\(\) \? router\.back\(\) : router\.replace\(regionHubRoute\(region\.id\)/);
  });

  it('results use their own key, which the server accepts and syncs', () => {
    expect(regionalResultKey('osh')).toBe('region:osh');
    const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260930000001_regional_challenges.sql'), 'utf8');
    const pattern = /check \(challenge_key ~ '([^']+)'\)/.exec(sql)![1];
    expect(new RegExp(pattern).test('region:jalal-abad')).toBe(true);
    expect(new RegExp(pattern).test('collection:horse-culture')).toBe(true);
    expect(new RegExp(pattern).test('region:../x')).toBe(false);
    expect((sql.match(/region:\[a-z0-9-\]\{1,60\}/g) ?? []).length).toBe(2);
  });

  it('no reward to farm: challenges grant no XP/coins, and a retry only keeps the best score', () => {
    const store = fs.readFileSync(path.join(ROOT, 'src/store/useChallengeStore.ts'), 'utf8');
    expect(store).toMatch(/no XP here at all/);
    expect(store).not.toMatch(/apply_reward|addXp|coins/);
    const first = recordCompletion(undefined, 2, 3, '2026-09-30T10:00:00.000Z');
    const retry = recordCompletion(first, 1, 3, '2026-09-30T11:00:00.000Z');
    // A weaker retry never lowers the best score (nothing to farm or lose).
    expect(retry).toMatchObject({ bestCorrect: 2, lastCorrect: 1, attempts: 2 });
  });

  it('region progress is unchanged by challenges (no new denominator)', () => {
    const naryn = getRegionExperience('naryn')!;
    expect(computeRegionProgress(naryn, { visitedRegionIds: [], discoveredIds: [], trails: {}, quests: {} }).total).toBe(2);
  });
});
