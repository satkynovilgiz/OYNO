import AsyncStorage from '@react-native-async-storage/async-storage';
import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { DETECTIVE_KEY, ownerDetective, useDetectiveStore } from '@/store/useDetectiveStore';
import { GAME_RECORDS_KEY } from '@/store/useGameRecordsStore';

import { buildSession, CLUE_POINTS, isFinished, MAX_CLUES, scoreAnswer, seededRng, sessionReducer, SESSION_LENGTH, startSession, summarize, type SessionState } from './detectiveModel';
import { DETECTIVE_QUESTIONS, questionArtwork, sourceRoute } from './detectiveQuestions';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const root = path.join(__dirname, '../../..');
const reviewed = {
  en: JSON.parse(fs.readFileSync(path.join(root, 'content/translations/culture_batch1.en.json'), 'utf8')) as Record<string, Record<string, string>>,
  ru: JSON.parse(fs.readFileSync(path.join(root, 'content/translations/culture_batch1.ru.json'), 'utf8')) as Record<string, Record<string, string>>,
};
const migrations = fs
  .readdirSync(path.join(root, 'supabase/migrations'))
  .map((file) => fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8'))
  .join('\n');
type Section = { names: Record<string, string>; questions: Record<string, Record<string, string>> };
const sections = { en: (en as unknown as { detective: Section }).detective, ru: (ru as unknown as { detective: Section }).detective, kg: (kg as unknown as { detective: Section }).detective };
const numbers = (text: string) => (text.replace(/(\d)[\s,](?=\d{3}\b)/g, '$1').match(/\d+/g) ?? []).filter((value) => value.length > 0);

describe('content: verified, sourced, complete', () => {
  it('at least eight questions, unique ids, each with a source item, bundled artwork and four distinct answers', () => {
    expect(DETECTIVE_QUESTIONS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(DETECTIVE_QUESTIONS.map((question) => question.id)).size).toBe(DETECTIVE_QUESTIONS.length);
    for (const question of DETECTIVE_QUESTIONS) {
      expect(questionArtwork(question)).toBeTruthy();
      expect(new Set(question.optionIds).size).toBe(4);
      expect(question.optionIds).toContain(question.sourceId);
      expect(sourceRoute(question)).toBe(`/culture/item/${question.sourceId}`);
      // The source item exists in the repository content.
      expect(migrations).toContain(`'${question.sourceId}'`);
    }
  });

  it('every clue/explanation field is a reviewed field of its source item (KG source + RU/EN reviewed)', () => {
    for (const question of DETECTIVE_QUESTIONS) {
      for (const field of [...question.clueFields, question.explanationField]) {
        expect(reviewed.en[question.sourceId]?.[field]).toBeTruthy();
        expect(reviewed.ru[question.sourceId]?.[field]).toBeTruthy();
      }
    }
  });

  it('no clue invents a number: every figure appears in the cited source field', () => {
    for (const question of DETECTIVE_QUESTIONS) {
      const fields = [...question.clueFields, question.explanationField];
      const keys = ['clue1', 'clue2', 'clue3', 'explanation'];
      for (const language of ['en', 'ru'] as const) {
        keys.forEach((key, index) => {
          const text = sections[language].questions[question.id][key];
          const source = reviewed[language][question.sourceId][fields[index]];
          for (const value of numbers(text)) expect([question.id, language, key, value, numbers(source).includes(value)]).toEqual([question.id, language, key, value, true]);
        });
      }
    }
  });

  it('KG / RU / EN: every name, clue and explanation; clues never name the answer', () => {
    for (const [language, section] of Object.entries(sections)) {
      for (const question of DETECTIVE_QUESTIONS) {
        for (const id of question.optionIds) expect([language, id, !!section.names[id]]).toEqual([language, id, true]);
        const texts = section.questions[question.id];
        for (const key of ['clue1', 'clue2', 'clue3', 'explanation']) expect([language, question.id, key, !!texts?.[key]]).toEqual([language, question.id, key, true]);
        const answer = section.names[question.sourceId].toLowerCase();
        for (const key of ['clue1', 'clue2', 'clue3']) expect([language, question.id, key, texts[key].toLowerCase().includes(answer)]).toEqual([language, question.id, key, false]);
      }
    }
  });
});

describe('scoring', () => {
  const question = { questionId: 'tunduk', sourceId: 'boz-uy-tunduk', options: ['boz-uy-tunduk', 'boz-uy-karkas', 'shyrdak-craft', 'horse-eer'] };

  it('fewer clues, more points; wrong answers score 0', () => {
    expect([0, 1, 2, 3].map((clues) => scoreAnswer(question, 'boz-uy-tunduk', clues).points)).toEqual([4, 3, 2, 1]);
    expect(scoreAnswer(question, 'horse-eer', 0)).toMatchObject({ correct: false, points: 0 });
    expect(scoreAnswer(question, 'boz-uy-tunduk', 9).cluesRevealed).toBe(MAX_CLUES);
    expect(CLUE_POINTS[0]).toBeGreaterThan(CLUE_POINTS[3]);
  });
});

describe('question selection', () => {
  it('five different questions per session, for many seeds; answers shuffled but complete', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const session = buildSession(seededRng(seed));
      expect(session).toHaveLength(SESSION_LENGTH);
      expect(new Set(session.map((item) => item.questionId)).size).toBe(SESSION_LENGTH);
      for (const item of session) expect([...item.options].sort()).toEqual([...DETECTIVE_QUESTIONS.find((question) => question.id === item.questionId)!.optionIds].sort());
    }
  });

  it('all questions appear across sessions (no question is unreachable)', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed += 1) for (const item of buildSession(seededRng(seed))) seen.add(item.questionId);
    expect(seen.size).toBe(DETECTIVE_QUESTIONS.length);
  });

  it('a focus round asks only the missed questions (fewer than five is fine); unknown ids are ignored', () => {
    const session = buildSession(seededRng(3), { onlyIds: ['tunduk', 'shyrdak', 'no-such'] });
    expect(session.map((item) => item.questionId).sort()).toEqual(['shyrdak', 'tunduk']);
  });
});

describe('session flow', () => {
  const play = (state: SessionState, pick: (state: SessionState) => string, clues = 0) => {
    let next = state;
    for (let index = 0; index < clues; index += 1) next = sessionReducer(next, { type: 'reveal' });
    next = sessionReducer(next, { type: 'answer', optionId: pick(next) });
    return sessionReducer(next, { type: 'next' });
  };
  const correct = (state: SessionState) => state.questions[state.index].sourceId;
  const wrong = (state: SessionState) => state.questions[state.index].options.find((option) => option !== state.questions[state.index].sourceId)!;

  it('start -> five answers -> results, with the right summary', () => {
    let state = startSession(buildSession(seededRng(42)));
    state = play(state, correct, 0); // 4
    state = play(state, correct, 3); // 1
    state = play(state, wrong, 1); // 0
    state = play(state, correct, 1); // 3
    state = play(state, wrong, 0); // 0
    expect(isFinished(state)).toBe(true);
    const summary = summarize(state);
    expect(summary).toMatchObject({ score: 8, maxScore: 20, correct: 3, total: 5, cluesUsed: 5 });
    expect(summary.missedIds).toEqual([state.questions[2].questionId, state.questions[4].questionId]);
  });

  it('a double tap never answers twice; reveal stops at three and after answering; next needs an answer', () => {
    let state = startSession(buildSession(seededRng(7)));
    expect(sessionReducer(state, { type: 'next' })).toBe(state);
    for (let index = 0; index < 5; index += 1) state = sessionReducer(state, { type: 'reveal' });
    expect(state.revealed).toBe(3);
    state = sessionReducer(state, { type: 'answer', optionId: correct(state) });
    const again = sessionReducer(state, { type: 'answer', optionId: correct(state) });
    expect(again).toBe(state);
    expect(state.answers).toHaveLength(1);
    expect(sessionReducer(state, { type: 'reveal' })).toBe(state);
    expect(sessionReducer(state, { type: 'answer', optionId: 'not-an-option' })).toBe(state);
  });
});

describe('scores are kept apart', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useDetectiveStore.setState({ saved: {}, isLoaded: true });
  });

  it('records sessions per owner in its own key - never official game records', async () => {
    useDetectiveStore.getState().recordSession('guest', { score: 12, missedIds: ['tunduk'], askedIds: ['tunduk', 'shyrdak'], focus: false });
    useDetectiveStore.getState().recordSession('guest', { score: 7, missedIds: [], askedIds: ['tunduk'], focus: true });
    expect(ownerDetective(useDetectiveStore.getState().saved, 'guest')).toMatchObject({ bestScore: 12, sessions: 2, lastMissedIds: [] });
    expect(ownerDetective(useDetectiveStore.getState().saved, 'user-b').sessions).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await AsyncStorage.getItem(DETECTIVE_KEY)).toBeTruthy();
    expect(await AsyncStorage.getItem(GAME_RECORDS_KEY)).toBeNull();
    expect(fs.readFileSync(path.join(__dirname, 'DetectiveScreen.tsx'), 'utf8')).not.toMatch(/useGameRecordsStore|useProgressStore|useChallengeStore/);
  });

  it('a focus round keeps earlier misses it did not ask', () => {
    useDetectiveStore.getState().recordSession('guest', { score: 4, missedIds: ['tunduk', 'shyrdak'], askedIds: ['tunduk', 'shyrdak', 'eer'], focus: false });
    useDetectiveStore.getState().recordSession('guest', { score: 4, missedIds: [], askedIds: ['tunduk'], focus: true });
    expect(ownerDetective(useDetectiveStore.getState().saved, 'guest').lastMissedIds).toEqual(['shyrdak']);
  });
});
