import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { recordFinishedAttempt, recordReviewAnswer, reviewQueue as mistakeQueue, EMPTY_MISTAKES } from '@/features/challenges/mistakes/mistakesModel';
import { applyAnswer, reviewQueue as glossaryQueue } from '@/features/culture/glossary/study/glossaryStudy';
import { LEARNING_PATHS, pathProgress, stepRoute, type PathSignals } from '@/features/learn/learningPaths';

import { buildStudyQueue, filterQueue, quickReviewPlan, studyPresentation, type StudyQueueInput } from './studyQueue';

const EMPTY: StudyQueueInput = { mistakeIds: [], glossaryIds: [], activePaths: [], unfinishedReading: [] };
const LIMITS = { paths: 3, reading: 3 };

describe('Study Queue', () => {
  it('priority: mistakes, then glossary, then paths, then reading - deterministic', () => {
    const input: StudyQueueInput = {
      mistakeIds: ['q2', 'q1'],
      glossaryIds: ['tunduk'],
      activePaths: [{ id: 'boz-uy', nextStepRoute: '/culture/item/boz-uy-karkas' }],
      unfinishedReading: [{ key: 'culture_item:oymo-overview', route: '/culture/item/oymo-overview' }],
    };
    const first = buildStudyQueue(input, LIMITS);
    expect(first.map((item) => item.type)).toEqual(['mistakes', 'glossary', 'path', 'reading']);
    expect(first.map((item) => item.priority)).toEqual([1, 2, 3, 4]);
    expect(buildStudyQueue(input, LIMITS)).toEqual(first);
    expect(first[0]).toMatchObject({ route: '/challenges/review', count: 2 });
    expect(first[1]).toMatchObject({ route: '/culture/glossary/study?mode=review', count: 1 });
    expect(first[2].route).toBe('/learn/boz-uy');
    expect(first[3].route).toBe('/culture/item/oymo-overview');
  });

  it('reuses the mistake queue order; a corrected mistake disappears', () => {
    let data = recordFinishedAttempt(EMPTY_MISTAKES, ['q1', 'q2']);
    data = recordFinishedAttempt(data, ['q2']);
    const exists = () => true;
    const ids = mistakeQueue(data, exists).map((record) => record.questionId);
    expect(ids).toEqual(['q2', 'q1']);
    expect(quickReviewPlan({ mistakeIds: ids, glossaryIds: [] }).mistakeIds).toEqual(['q2', 'q1']);
    data = recordReviewAnswer(data, 'q2', true);
    const after = mistakeQueue(data, exists).map((record) => record.questionId);
    expect(buildStudyQueue({ ...EMPTY, mistakeIds: after }, LIMITS)[0].count).toBe(1);
    data = recordReviewAnswer(data, 'q1', true);
    expect(buildStudyQueue({ ...EMPTY, mistakeIds: mistakeQueue(data, exists).map((record) => record.questionId) }, LIMITS)).toEqual([]);
  });

  it('a glossary term marked Got it leaves the queue', () => {
    let study = applyAnswer({}, 'tunduk', 'review_again');
    study = applyAnswer(study, 'kerege', 'review_again');
    expect(glossaryQueue(study, ['tunduk', 'kerege']).length).toBe(2);
    study = applyAnswer(study, 'tunduk', 'got_it');
    const ids = glossaryQueue(study, ['tunduk', 'kerege']);
    expect(ids).toEqual(['kerege']);
    expect(buildStudyQueue({ ...EMPTY, glossaryIds: ids }, LIMITS)[0].count).toBe(1);
  });

  it('a path item uses the existing first unfinished step (no second algorithm)', () => {
    const no = () => false;
    const signals: PathSignals = { readingCompleted: (id) => id === 'boz-uy-overview', readingStarted: (id) => id === 'boz-uy-overview', glossaryGotIt: no, glossarySeen: no, challengeCompleted: no, challengeStarted: no, gamePlayed: no, labFlag: no, manualCompleted: no };
    const pathDef = LEARNING_PATHS[0];
    const progress = pathProgress(pathDef, signals);
    const nextStepRoute = progress.nextIndex === null ? null : stepRoute(pathDef.steps[progress.nextIndex], (gameId) => `/games/${gameId}`);
    expect(progress.nextIndex).toBe(1);
    expect(nextStepRoute).toContain('boz-uy-karkas');
  });

  it('quick review: at most 3 mistakes + 3 glossary cards, never articles', () => {
    const plan = quickReviewPlan({ mistakeIds: ['a', 'b', 'c', 'd'], glossaryIds: ['1', '2', '3', '4', '5'] });
    expect(plan).toEqual({ mistakeIds: ['a', 'b', 'c'], glossaryIds: ['1', '2', '3'] });
    expect(Object.keys(plan)).toEqual(['mistakeIds', 'glossaryIds']);
  });

  it('empty state: nothing waiting -> empty queue', () => {
    expect(buildStudyQueue(EMPTY, LIMITS)).toEqual([]);
  });

  it('filters: All / Review / Reading / Paths', () => {
    const queue = buildStudyQueue({ mistakeIds: ['q'], glossaryIds: ['g'], activePaths: [{ id: 'boz-uy', nextStepRoute: null }], unfinishedReading: [{ key: 'r', route: '/culture/item/r' }] }, LIMITS);
    expect(filterQueue(queue, 'review').map((item) => item.type)).toEqual(['mistakes', 'glossary']);
    expect(filterQueue(queue, 'reading').map((item) => item.type)).toEqual(['reading']);
    expect(filterQueue(queue, 'paths').map((item) => item.type)).toEqual(['path']);
    expect(filterQueue(queue, 'all')).toHaveLength(4);
  });

  it('age: same items, children see fewer cards with larger actions; adults a compact list', () => {
    expect(studyPresentation('child')).toMatchObject({ paths: 1, reading: 1, largeActions: true });
    expect(studyPresentation('preteen').reviewFirstEmphasis).toBe(true);
    expect(studyPresentation('adult')).toMatchObject({ compact: true });
    const reading = Array.from({ length: 6 }, (_, index) => ({ key: `r${index}`, route: `/culture/item/r${index}` }));
    expect(buildStudyQueue({ ...EMPTY, unfinishedReading: reading }, studyPresentation('child'))).toHaveLength(1);
    expect(buildStudyQueue({ ...EMPTY, unfinishedReading: reading }, studyPresentation('adult'))).toHaveLength(5);
  });

  it('owner switching: the queue is derived only from the input it is given (no storage of its own)', () => {
    const ownerA: StudyQueueInput = { ...EMPTY, mistakeIds: ['q1'] };
    const ownerB: StudyQueueInput = EMPTY;
    expect(buildStudyQueue(ownerA, LIMITS)).toHaveLength(1);
    expect(buildStudyQueue(ownerB, LIMITS)).toHaveLength(0);
    const source = ['studyQueue.ts', 'useStudyQueue.ts', 'StudyQueueScreen.tsx', 'QuickReviewScreen.tsx'].map((file) => fs.readFileSync(path.join(__dirname, file), 'utf8')).join('\n');
    expect(source).not.toMatch(/AsyncStorage|create<|zustand/);
  });

  it('privacy: never reads the Journal, highlight notes or collection descriptions', () => {
    const source = ['studyQueue.ts', 'useStudyQueue.ts', 'StudyQueueScreen.tsx', 'QuickReviewScreen.tsx'].map((file) => fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')).join('\n');
    expect(source).not.toMatch(/useJournalStore|useHighlightsStore|useMyCollectionsStore|\.note\b|description/);
  });

  it('no rewards, scores or generated questions', () => {
    const source = ['studyQueue.ts', 'StudyQueueScreen.tsx'].map((file) => fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')).join('\n');
    expect(source).not.toMatch(/\bxp\b|coins|reward|leaderboard|generate/i);
  });

  it('KG / RU / EN copy', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { study: Record<string, unknown> }).study;
      for (const key of ['short', 'title', 'quickReview', 'review', 'continueLearning', 'continueReading', 'caughtUp', 'questionsToReview', 'termsToReview', 'discover']) {
        expect(typeof block[key] === 'string' && (block[key] as string).length > 0).toBe(true);
      }
    }
    expect((en as unknown as { study: { caughtUp: string } }).study.caughtUp).toBe("You're all caught up");
    expect(JSON.stringify((en as unknown as { study: unknown }).study)).not.toMatch(/mastered/i);
  });
});
