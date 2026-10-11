/** Mystery Object: question integrity (sources, spoilers, one answer), options, missing content, attempt transitions. */
import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import { attemptReducer, availableMysteries, clueSources, explanationSource, keepAttempt, MAX_CLUES, MYSTERIES, MYSTERY_IDS, pickMystery, resumeAttempt, startAttempt } from './mysteryModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

type Detective = { names: Record<string, string>; questions: Record<string, Record<string, string>> };
const locales = { en: (en as unknown as { detective: Detective }).detective, ru: (ru as unknown as { detective: Detective }).detective, kg: (kg as unknown as { detective: Detective }).detective };
const text = (lang: keyof typeof locales, key: string) => {
  const [, , id, field] = key.split('.');
  return locales[lang].questions[id]?.[field];
};
const seeded = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const fold = (value: string) => value.toLocaleLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

describe('question integrity', () => {
  it('every listed mystery exists; every clue has an inspectable source in all three languages', () => {
    expect(MYSTERIES.map((mystery) => mystery.id)).toEqual([...MYSTERY_IDS]);
    for (const mystery of MYSTERIES) {
      const sources = clueSources(mystery);
      expect(sources).toHaveLength(MAX_CLUES);
      for (const source of [...sources, explanationSource(mystery)]) {
        expect(source.articleId).toBe(mystery.sourceId);
        expect(source.field).toMatch(/^[a-z_]+$/);
        for (const lang of ['en', 'ru', 'kg'] as const) expect(text(lang, source.textKey)?.trim()).toBeTruthy();
      }
    }
  });

  it('no clue names its own answer (in any language)', () => {
    for (const mystery of MYSTERIES)
      for (const lang of ['en', 'ru', 'kg'] as const) {
        const answer = fold(locales[lang].names[mystery.sourceId]);
        for (const source of clueSources(mystery)) expect({ mystery: mystery.id, lang, spoils: fold(text(lang, source.textKey)).includes(answer) }).toEqual({ mystery: mystery.id, lang, spoils: false });
      }
  });

  it('exactly one intended answer among four distinct, named options', () => {
    for (const mystery of MYSTERIES) {
      expect(new Set(mystery.optionIds).size).toBe(4);
      expect(mystery.optionIds.filter((id) => id === mystery.sourceId)).toHaveLength(1);
      for (const lang of ['en', 'ru', 'kg'] as const) {
        const names = mystery.optionIds.map((id) => locales[lang].names[id]);
        expect(names.every(Boolean)).toBe(true);
        expect(new Set(names.map(fold)).size).toBe(4);
      }
    }
  });
});

describe('options and availability', () => {
  it('options: the same four, in a random order', () => {
    const mystery = MYSTERIES[0];
    const orders = new Set(Array.from({ length: 20 }, (_, index) => startAttempt(mystery, seeded(index + 1)).options.join('|')));
    expect(orders.size).toBeGreaterThan(1);
    for (const order of orders) expect(order.split('|').sort()).toEqual([...mystery.optionIds].sort());
  });

  it('a missing answer or distractor removes that mystery; with nothing left there is no round', () => {
    const all = new Set(MYSTERIES.flatMap((mystery) => mystery.optionIds));
    expect(availableMysteries((id) => all.has(id))).toHaveLength(MYSTERIES.length);
    const withoutTunduk = availableMysteries((id) => id !== 'boz-uy-tunduk');
    expect(withoutTunduk.some((mystery) => mystery.optionIds.includes('boz-uy-tunduk'))).toBe(false);
    expect(availableMysteries(() => false)).toEqual([]);
    expect(pickMystery([], null)).toBeNull();
    expect(pickMystery(MYSTERIES.slice(0, 2), MYSTERIES[0].id, () => 0)?.id).toBe(MYSTERIES[1].id);
  });
});

describe('attempt transitions', () => {
  const mystery = MYSTERIES[0];
  const wrong = mystery.optionIds.filter((id) => id !== mystery.sourceId);
  it('reveal up to three; a wrong guess keeps the round going; the right one ends it', () => {
    let attempt = startAttempt(mystery, seeded(3));
    expect(attempt).toMatchObject({ revealed: 1, wrong: [], outcome: 'playing' });
    for (let index = 0; index < 5; index += 1) attempt = attemptReducer(attempt, { type: 'reveal' }, mystery);
    expect(attempt.revealed).toBe(MAX_CLUES);
    attempt = attemptReducer(attempt, { type: 'guess', optionId: wrong[0] }, mystery);
    attempt = attemptReducer(attempt, { type: 'guess', optionId: wrong[0] }, mystery); // the same wrong guess again: no change
    expect(attempt).toMatchObject({ wrong: [wrong[0]], outcome: 'playing' });
    expect(attemptReducer(attempt, { type: 'guess', optionId: 'not-an-option' }, mystery)).toBe(attempt);
    attempt = attemptReducer(attempt, { type: 'guess', optionId: mystery.sourceId }, mystery);
    expect(attempt.outcome).toBe('found');
    expect(attemptReducer(attempt, { type: 'reveal' }, mystery)).toBe(attempt); // finished
  });
  it('showing the answer ends the round without a guess', () => {
    expect(attemptReducer(startAttempt(mystery), { type: 'showAnswer' }, mystery).outcome).toBe('shown');
  });
  it('the attempt survives leaving (memory, per owner)', () => {
    const attempt = attemptReducer(attemptReducer(startAttempt(mystery), { type: 'reveal' }, mystery), { type: 'guess', optionId: wrong[1] }, mystery);
    keepAttempt('user-a', attempt);
    expect(resumeAttempt('user-a')).toEqual(attempt);
    expect(resumeAttempt('user-b')).toBeNull();
  });
});
