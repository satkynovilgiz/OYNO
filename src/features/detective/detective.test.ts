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
import { expedition, EXPEDITIONS, expeditionQuestions } from './expeditions';

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

describe('expeditions', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useDetectiveStore.setState({ saved: {}, isLoaded: true });
  });

  it('three themes, each built only from verified questions, at most five, never repeated', () => {
    expect(EXPEDITIONS.map((item) => item.id)).toEqual(['yurt', 'horse', 'ornament']);
    for (const item of EXPEDITIONS) {
      expect(new Set(item.questionIds).size).toBe(item.questionIds.length);
      expect(item.questionIds.length).toBeLessThanOrEqual(SESSION_LENGTH);
      expect(expeditionQuestions(item).map((question) => question.id)).toEqual(item.questionIds);
      for (const lang of [en, ru, kg]) {
        const themes = (lang as unknown as { detective: { expeditions: { themes: Record<string, { title: string; topic: string }> } } }).detective.expeditions.themes;
        expect(themes[item.id].title).toBeTruthy();
        expect(themes[item.id].topic).toBeTruthy();
      }
      for (let seed = 1; seed <= 25; seed += 1) {
        const session = buildSession(seededRng(seed), { onlyIds: item.questionIds, length: item.questionIds.length });
        expect(session.map((question) => question.questionId).sort()).toEqual([...item.questionIds].sort());
      }
    }
    // A shorter theme is shorter - nothing is invented to pad it.
    expect(expedition('ornament')!.questionIds).toHaveLength(4);
    expect(expedition('nope' as never)).toBeUndefined();
  });

  it('the learning round opens every clue, the challenge starts with none - and each scores its own way', () => {
    const questions = buildSession(seededRng(3), { onlyIds: expedition('yurt')!.questionIds, length: 5 });
    let learning = startSession(questions, { startRevealed: MAX_CLUES });
    expect(learning.revealed).toBe(MAX_CLUES);
    learning = sessionReducer(learning, { type: 'answer', optionId: questions[0].sourceId });
    learning = sessionReducer(learning, { type: 'next' });
    expect(learning.revealed).toBe(MAX_CLUES);
    expect(learning.answers[0].points).toBe(CLUE_POINTS[MAX_CLUES]);
    const challenge = startSession(questions);
    expect(challenge.revealed).toBe(0);
  });

  it('learning and challenge are separate categories; practice touches neither; quick play is untouched', () => {
    const store = useDetectiveStore.getState();
    store.recordSession('guest', { score: 11, missedIds: ['eer'], askedIds: ['eer'], focus: false });
    const asked = expedition('yurt')!.questionIds;
    store.recordExpedition('guest', 'yurt', { round: 'learning', correct: 4, total: 5, score: 4, maxScore: 20, missedIds: ['tunduk'], askedIds: asked });
    store.recordExpedition('guest', 'yurt', { round: 'challenge', correct: 3, total: 5, score: 9, maxScore: 20, missedIds: ['tunduk', 'karkas'], askedIds: asked });
    let record = ownerDetective(useDetectiveStore.getState().saved, 'guest');
    expect(record.expeditions.yurt).toEqual({ learning: { bestCorrect: 4, total: 5, rounds: 1 }, challenge: { bestScore: 9, maxScore: 20, rounds: 1 }, missedIds: ['tunduk', 'karkas'] });
    store.recordExpedition('guest', 'yurt', { round: 'practice', correct: 1, total: 1, score: 1, maxScore: 4, missedIds: [], askedIds: ['tunduk'] });
    record = ownerDetective(useDetectiveStore.getState().saved, 'guest');
    expect(record.expeditions.yurt).toEqual({ learning: { bestCorrect: 4, total: 5, rounds: 1 }, challenge: { bestScore: 9, maxScore: 20, rounds: 1 }, missedIds: ['karkas'] });
    expect(record).toMatchObject({ bestScore: 11, sessions: 1, lastMissedIds: ['eer'] });
    // A quick-play session keeps the expedition history.
    store.recordSession('guest', { score: 2, missedIds: [], askedIds: ['eer'], focus: true });
    expect(ownerDetective(useDetectiveStore.getState().saved, 'guest').expeditions.yurt?.missedIds).toEqual(['karkas']);
    // Missed ids from another theme are never stored in this one.
    store.recordExpedition('guest', 'horse', { round: 'learning', correct: 0, total: 1, score: 0, maxScore: 4, missedIds: ['tunduk'], askedIds: ['tunduk'] });
    expect(ownerDetective(useDetectiveStore.getState().saved, 'guest').expeditions.horse?.missedIds).toEqual([]);
  });

  it("one account's expeditions are never another's", () => {
    useDetectiveStore.getState().recordExpedition('user-a', 'horse', { round: 'learning', correct: 5, total: 5, score: 5, maxScore: 20, missedIds: [], askedIds: expedition('horse')!.questionIds });
    expect(ownerDetective(useDetectiveStore.getState().saved, 'user-b').expeditions).toEqual({});
    expect(ownerDetective(useDetectiveStore.getState().saved, 'guest').expeditions).toEqual({});
  });

  it('history saved before Expeditions survives, and tampered expedition data is dropped', async () => {
    await AsyncStorage.setItem(DETECTIVE_KEY, JSON.stringify({ guest: { bestScore: 9, sessions: 3, lastMissedIds: ['tunduk'], lastPlayedAt: '2026-10-01T10:00:00.000Z' }, 'user-a': { bestScore: 2, sessions: 1, lastMissedIds: [], lastPlayedAt: null, expeditions: { yurt: { learning: { bestCorrect: 3, total: 5, rounds: 2 }, challenge: 'x', missedIds: ['karkas', 'eer', 7] }, unknown: { learning: null } } } }));
    useDetectiveStore.setState({ saved: {}, isLoaded: false });
    await useDetectiveStore.getState().load();
    const saved = useDetectiveStore.getState().saved;
    expect(ownerDetective(saved, 'guest')).toEqual({ bestScore: 9, sessions: 3, lastMissedIds: ['tunduk'], lastPlayedAt: '2026-10-01T10:00:00.000Z', expeditions: {} });
    expect(ownerDetective(saved, 'user-a').expeditions).toEqual({ yurt: { learning: { bestCorrect: 3, total: 5, rounds: 2 }, challenge: null, missedIds: ['karkas'] } });
  });

  it('the summary reports actual answers per round and links each object to its article', () => {
    const screen = fs.readFileSync(path.join(__dirname, 'DetectiveScreen.tsx'), 'utf8');
    expect(screen).toContain("find('learning', questionId)");
    expect(screen).toContain("find('challenge', questionId)");
    expect(screen).toContain('router.push(sourceRoute(question)');
    expect(screen).not.toMatch(/useGameRecordsStore|useProgressStore|useChallengeStore/);
  });
});
