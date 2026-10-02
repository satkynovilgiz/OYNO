import * as fs from 'fs';
import * as path from 'path';

import AsyncStorage from '@react-native-async-storage/async-storage';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { ownerMistakes, useChallengeMistakesStore } from '@/store/useChallengeMistakesStore';
import { useChallengeStore } from '@/store/useChallengeStore';

import { QUESTION_BANK } from '../questionBank';
import { EMPTY_MISTAKES, mergeMistakes, pruneStale, recordFinishedAttempt, recordReviewAnswer, reviewQueue, wrongIdsOf } from './mistakesModel';
import { questionExists } from './questionExists';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));
jest.mock('@/services/sync/syncTrigger', () => ({ requestAccountSync: jest.fn() }));

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 1, 10, minutes));
const [q1, q2, q3] = QUESTION_BANK.slice(0, 3);
const runScreen = fs.readFileSync(path.join(__dirname, '../ChallengeRunScreen.tsx'), 'utf8');

describe('Challenge Mistake Review - model', () => {
  it('a wrong answer in a finished challenge creates a mistake; a correct one does not', () => {
    const answers = [
      { questionId: q1.id, optionId: q1.options.find((option) => option.id !== q1.correctOptionId)!.id },
      { questionId: q2.id, optionId: q2.correctOptionId },
    ];
    const data = recordFinishedAttempt(EMPTY_MISTAKES, wrongIdsOf([q1, q2], answers), at(0));
    expect(Object.keys(data.active)).toEqual([q1.id]);
    expect(data.active[q1.id]).toEqual({ questionId: q1.id, firstWrongAt: at(0).toISOString(), lastWrongAt: at(0).toISOString(), wrongCount: 1 });
    expect(recordFinishedAttempt(EMPTY_MISTAKES, [], at(0))).toBe(EMPTY_MISTAKES);
  });

  it('the same question again increments instead of duplicating', () => {
    const twice = recordFinishedAttempt(recordFinishedAttempt(EMPTY_MISTAKES, [q1.id], at(0)), [q1.id, q1.id], at(5));
    expect(Object.keys(twice.active)).toHaveLength(1);
    expect(twice.active[q1.id]).toMatchObject({ wrongCount: 2, firstWrongAt: at(0).toISOString(), lastWrongAt: at(5).toISOString() });
  });

  it('right in Review -> leaves the queue ("Reviewed"); wrong in Review -> stays, count and date bumped', () => {
    const data = recordFinishedAttempt(EMPTY_MISTAKES, [q1.id, q2.id], at(0));
    const right = recordReviewAnswer(data, q1.id, true, at(10));
    expect(right.active[q1.id]).toBeUndefined();
    expect(right.reviewedAt[q1.id]).toBe(at(10).toISOString());
    const wrong = recordReviewAnswer(data, q2.id, false, at(11));
    expect(wrong.active[q2.id]).toMatchObject({ wrongCount: 2, lastWrongAt: at(11).toISOString() });
  });

  it('deterministic order: most wrong, then most recent, then id', () => {
    let data = recordFinishedAttempt(EMPTY_MISTAKES, [q1.id, q2.id, q3.id], at(0));
    data = recordFinishedAttempt(data, [q3.id], at(1));
    data = recordFinishedAttempt(data, [q2.id], at(2));
    // q2 and q3 have 2 each; q2 was wrong more recently.
    expect(reviewQueue(data, questionExists).map((record) => record.questionId)).toEqual([q2.id, q3.id, q1.id]);
    const tie = recordFinishedAttempt(EMPTY_MISTAKES, [q3.id, q1.id], at(0));
    expect(reviewQueue(tie, questionExists).map((record) => record.questionId)).toEqual([q1.id, q3.id].sort());
  });

  it('a question removed from QUESTION_BANK is skipped and cleaned, never a crash', () => {
    const data = recordFinishedAttempt(EMPTY_MISTAKES, [q1.id, 'removed-question'], at(0));
    expect(reviewQueue(data, questionExists).map((record) => record.questionId)).toEqual([q1.id]);
    expect(Object.keys(pruneStale(data, questionExists).active)).toEqual([q1.id]);
  });

  it('guest -> account merge: one record per question, earliest first, latest last, counts added', () => {
    const account = recordFinishedAttempt(EMPTY_MISTAKES, [q1.id], at(5));
    const guest = recordFinishedAttempt(recordFinishedAttempt(EMPTY_MISTAKES, [q1.id], at(0)), [q1.id, q2.id], at(9));
    const merged = mergeMistakes(account, guest);
    expect(Object.keys(merged.active).sort()).toEqual([q1.id, q2.id].sort());
    expect(merged.active[q1.id]).toEqual({ questionId: q1.id, firstWrongAt: at(0).toISOString(), lastWrongAt: at(9).toISOString(), wrongCount: 3 });
  });
});

describe('Challenge Mistake Review - recording rule and score isolation', () => {
  it('mistakes are recorded only when a NORMAL run finishes (abandoned runs never reach it)', () => {
    const finish = runScreen.slice(runScreen.indexOf('function next()'));
    expect(finish).toMatch(/if \(index \+ 1 >= questions\.length\) \{[\s\S]*?if \(!isReview\) \{[\s\S]*?recordAttempt\(owner, wrongIdsOf\(questions, answers\)\)/);
    expect(runScreen.match(/recordAttempt\(/g)).toHaveLength(1);
  });

  it('review never changes challenge best score, attempts or completion', async () => {
    useChallengeStore.setState({ results: { 'daily:2026-10-01': { startedAt: 'x', completedAt: 'y', lastCorrect: 3, lastTotal: 5, bestCorrect: 4, attempts: 2 } } });
    const before = JSON.stringify(useChallengeStore.getState().results);
    useChallengeMistakesStore.setState({ isLoaded: true, saved: {} });
    useChallengeMistakesStore.getState().recordAttempt('guest', [q1.id]);
    useChallengeMistakesStore.getState().recordReview('guest', q1.id, true);
    useChallengeMistakesStore.getState().recordReview('guest', q2.id, false);
    expect(JSON.stringify(useChallengeStore.getState().results)).toBe(before);
    // In review mode the run screen skips complete()/start() entirely.
    expect(runScreen).toMatch(/if \(questions\.length === 0 \|\| isReview\) return;/);
    expect(runScreen).toMatch(/if \(!isReview\) \{\s*useChallengeStore\.getState\(\)\.complete/);
    const store = fs.readFileSync(path.join(__dirname, '../../../store/useChallengeMistakesStore.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(store).not.toMatch(/useChallengeStore|useProgressStore|addXp|addCoins|discover/);
  });

  it('review keeps the existing verification note and Learn more (same screen, same helpers)', () => {
    expect(fs.existsSync(path.join(__dirname, '../../../app/challenges/review.tsx'))).toBe(true);
    expect(fs.readFileSync(path.join(__dirname, '../../../app/challenges/review.tsx'), 'utf8')).toMatch(/<ChallengeRunScreen challengeId="review"/);
    expect(runScreen).toMatch(/questionReviewLevel\(question\.id, sourceLevel\)/);
    expect(runScreen).toMatch(/routeForSource\(question\)/);
  });

  it('analytics: only question_id and correct', () => {
    expect(runScreen).toMatch(/track\('challenge_review_answered', \{ question_id: question\.id, correct: optionId === question\.correctOptionId \}\)/);
  });
});

describe('Challenge Mistake Review - storage and accounts', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useChallengeMistakesStore.setState({ isLoaded: false, saved: {} });
  });

  it('guest mistakes persist on the device', async () => {
    await useChallengeMistakesStore.getState().load();
    useChallengeMistakesStore.getState().recordAttempt('guest', [q1.id]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    useChallengeMistakesStore.setState({ isLoaded: false, saved: {} });
    await useChallengeMistakesStore.getState().load();
    expect(Object.keys(ownerMistakes(useChallengeMistakesStore.getState().saved, 'guest').active)).toEqual([q1.id]);
  });

  it('guest -> A adopted; A -> B: B never sees A', async () => {
    await useChallengeMistakesStore.getState().load();
    useChallengeMistakesStore.getState().recordAttempt('guest', [q1.id]);
    useChallengeMistakesStore.getState().adoptGuest('user-a');
    useChallengeMistakesStore.getState().recordAttempt('user-a', [q2.id]);
    const saved = useChallengeMistakesStore.getState().saved;
    expect(Object.keys(ownerMistakes(saved, 'user-a').active).sort()).toEqual([q1.id, q2.id].sort());
    expect(ownerMistakes(saved, 'guest')).toEqual(EMPTY_MISTAKES);
    expect(ownerMistakes(saved, 'user-b')).toEqual(EMPTY_MISTAKES);
  });

  it('KG / RU / EN strings', () => {
    for (const dict of [kg, ru, en]) {
      const review = (dict as unknown as { challenges: { review: Record<string, string> } }).challenges.review;
      for (const key of ['title', 'toRevisitLabel', 'emptyTitle', 'again', 'reviewed', 'learnMore', 'toRevisit_other', 'onThisDevice']) expect(review[key]).toBeTruthy();
    }
  });
});
