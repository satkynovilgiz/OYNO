import AsyncStorage from '@react-native-async-storage/async-storage';

import { getCollection } from '@/features/collections/collectionsData';
import { cultureItemImages } from '@/features/culture/data';
import { natureSiteCoordinates, natureSiteImages } from '@/features/explore/data';
import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { recordCompletion, useChallengeStore } from '@/store/useChallengeStore';

import { collectionQuestionIds, journeyQuestionIds, pickDailyQuestionIds, scoreAnswers, validateQuestion } from './challengeLogic';
import { QUESTION_BANK, type ChallengeQuestion } from './questionBank';

// Real culture_materials ids (verified against the live table).
const MATERIAL_IDS = ['komuz-discovery', 'kalpak-history', 'boorsok-cooking', 'kyz-kuumai-game'];

function sourceExists(question: ChallengeQuestion): boolean {
  if (question.sourceType === 'destination') return !!natureSiteCoordinates[question.sourceId];
  if (question.sourceType === 'culture_material') return MATERIAL_IDS.includes(question.sourceId);
  return !!cultureItemImages[question.sourceId];
}

describe('question bank', () => {
  it('has unique question ids', () => {
    const ids = QUESTION_BANK.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(QUESTION_BANK.map((question) => [question.id, question] as const))('%s is structurally valid with exactly one correct answer', (_id, question) => {
    expect(validateQuestion(question)).toEqual([]);
  });

  it('every question points to real existing content', () => {
    expect(QUESTION_BANK.filter((question) => !sourceExists(question)).map((question) => question.id)).toEqual([]);
  });

  it('every image option shows a real bundled photo', () => {
    for (const question of QUESTION_BANK) {
      for (const option of question.options) {
        if (!option.image) continue;
        const image = option.image.type === 'destination' ? natureSiteImages[option.image.id] : cultureItemImages[option.image.id]?.[0];
        expect(image).toBeTruthy();
      }
    }
  });

  it('flags a question with no or two correct answers', () => {
    const bad: ChallengeQuestion = { ...QUESTION_BANK[0], options: [{ id: 'a' }, { id: 'a' }, { id: 'b' }], correctOptionId: 'a' };
    expect(validateQuestion(bad)).toContain('needs exactly one correct option');
    expect(validateQuestion({ ...QUESTION_BANK[0], correctOptionId: 'missing' })).toContain('needs exactly one correct option');
  });

  it.each([
    ['kg', kg],
    ['ru', ru],
    ['en', en],
  ] as const)('every question is translated in %s', (_lang, locale) => {
    const questions = (locale as { challenges: { questions: Record<string, { question?: string; explanation?: string; options?: Record<string, string> }> } }).challenges.questions;
    for (const question of QUESTION_BANK) {
      const entry = questions[question.id];
      expect(entry?.question).toBeTruthy();
      expect(entry?.explanation).toBeTruthy();
      if (question.kind === 'multiple') for (const option of question.options) expect(entry?.options?.[option.id]).toBeTruthy();
    }
  });
});

describe('challenge selection', () => {
  it('daily selection is deterministic per date and changes across dates', () => {
    const today = pickDailyQuestionIds('2026-09-23', 5);
    expect(pickDailyQuestionIds('2026-09-23', 5)).toEqual(today);
    expect(today).toHaveLength(5);
    expect(new Set(today).size).toBe(5);
    expect(pickDailyQuestionIds('2026-09-24', 5)).not.toEqual(today);
  });

  it('collection challenges use only that collection’s content, 5-10 questions', () => {
    for (const id of ['boz-uy-world', 'horse-culture', 'kyrgyz-ornament']) {
      const ids = collectionQuestionIds(getCollection(id)!);
      expect(ids.length).toBeGreaterThanOrEqual(5);
      expect(ids.length).toBeLessThanOrEqual(10);
    }
  });

  it('journey challenge needs real explored content', () => {
    expect(journeyQuestionIds([], [])).toEqual([]);
    expect(journeyQuestionIds(['son-kol'], [])).toEqual([]); // too few to be a challenge
    const ids = journeyQuestionIds(['son-kol', 'sary-chelek', 'arslanbob'], []);
    expect(ids).toEqual(expect.arrayContaining(['son-kol-altitude', 'image-son-kol', 'sary-chelek-depth', 'arslanbob-forest']));
  });

  it('scores answers', () => {
    expect(scoreAnswers([
      { questionId: 'komuz-strings', optionId: 'three' },
      { questionId: 'kymyz', optionId: 'tea' },
      { questionId: 'tunduk-position', optionId: 'false' },
    ])).toEqual({ correct: 2, total: 3 });
  });
});

describe('challenge progress', () => {
  it('keeps the best score and never lowers it', () => {
    const first = recordCompletion(undefined, 4, 5, '2026-09-23T10:00:00Z');
    const second = recordCompletion(first, 2, 5, '2026-09-24T10:00:00Z');
    expect(second).toMatchObject({ bestCorrect: 4, lastCorrect: 2, attempts: 2, startedAt: '2026-09-23T10:00:00Z' });
  });

  it('persists completion and today’s daily identity', async () => {
    await AsyncStorage.clear();
    const store = useChallengeStore.getState();
    const ids = store.dailyQuestionIds('2026-09-23', () => ['kymyz', 'hooves']);
    expect(useChallengeStore.getState().dailyQuestionIds('2026-09-23', () => ['other'])).toEqual(ids);
    useChallengeStore.getState().complete('daily:2026-09-23', 1, 2);
    await new Promise((resolve) => setTimeout(resolve, 0));
    useChallengeStore.setState({ daily: null, results: {}, isLoaded: false });
    await useChallengeStore.getState().load();
    expect(useChallengeStore.getState().daily).toEqual({ date: '2026-09-23', questionIds: ['kymyz', 'hooves'] });
    expect(useChallengeStore.getState().results['daily:2026-09-23']).toMatchObject({ lastCorrect: 1, lastTotal: 2 });
  });
});
