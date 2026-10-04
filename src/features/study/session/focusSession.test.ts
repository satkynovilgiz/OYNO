import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import type { StudyQueueInput } from '../studyQueue';
import {
  activityDone,
  buildStudySession,
  currentActivity,
  currentGroup,
  endSession,
  isFinished,
  refreshSession,
  SESSION_SIZES,
  sessionFor,
  sessionSummary,
  sizesFor,
  skipActivity,
  startSession,
  type CompletionSignals,
} from './focusSession';
import { sanitizeSettings, studyReminderIds } from './studyReminders';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('@/services/reminders/reminderScheduler', () => ({ requestReminderPermission: jest.fn() }));

const root = path.join(__dirname, '../../../..');
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

const input: StudyQueueInput = {
  mistakeIds: ['q1', 'q2', 'q1'],
  glossaryIds: ['tunduk', 'kalpak'],
  activePaths: [
    { id: 'boz-uy', nextStepRoute: '/culture/item/boz-uy-karkas', nextIndex: 1 },
    { id: 'horse-games', nextStepRoute: null, nextIndex: null },
  ],
  unfinishedReading: [
    { key: 'culture_item:komuz-overview', route: '/culture/item/komuz-overview' },
    { key: 'culture_item:boz-uy-overview', route: '/culture/item/boz-uy-overview' },
  ],
};
const EMPTY: CompletionSignals = { mistakes: { active: {}, reviewedAt: {} }, glossary: {}, pathStates: {}, reading: {} };
const T0 = new Date('2026-10-03T10:00:00.000Z');
const LATER = '2026-10-03T10:05:00.000Z';
const BEFORE = '2026-10-02T10:00:00.000Z';

describe('buildStudySession', () => {
  it('sizes are 3 / 5 / 8', () => {
    expect(SESSION_SIZES).toEqual({ quick: 3, standard: 5, deep: 8 });
  });

  it('review first, then path step, then reading; no duplicates', () => {
    const deep = buildStudySession(input, 'deep', { 'culture_item:komuz-overview': 0.3 });
    expect(deep.map((activity) => activity.key)).toEqual(['mistake:q1', 'mistake:q2', 'glossary:tunduk', 'glossary:kalpak', 'path:boz-uy:1', 'reading:culture_item:komuz-overview', 'reading:culture_item:boz-uy-overview']);
    expect(new Set(deep.map((activity) => activity.key)).size).toBe(deep.length);
    expect(deep.find((activity) => activity.type === 'reading')?.baseline).toBe(0.3);
  });

  it('caps at the size and never pads', () => {
    expect(buildStudySession(input, 'quick').map((activity) => activity.type)).toEqual(['mistake', 'mistake', 'glossary']);
    expect(buildStudySession(input, 'standard')).toHaveLength(5);
    expect(buildStudySession(input, 'deep')).toHaveLength(7); // only 7 real activities exist
    expect(buildStudySession({ mistakeIds: [], glossaryIds: [], activePaths: [], unfinishedReading: [] }, 'deep')).toEqual([]);
  });

  it('age modes: children get only short sessions', () => {
    expect(sizesFor('child')).toEqual(['quick']);
    expect(sizesFor('preteen')).toEqual(['quick', 'standard']);
    expect(sizesFor('adult')).toEqual(['quick', 'standard', 'deep']);
  });
});

describe('completion only from real signals', () => {
  const [mistake, , glossary, , step, reading] = buildStudySession(input, 'deep', { 'culture_item:komuz-overview': 0.3 });
  const startedAt = T0.toISOString();

  it('opening an activity is not completion; old records do not count', () => {
    for (const activity of [mistake, glossary, step, reading]) expect(activityDone(activity, EMPTY, startedAt)).toBe(false);
    expect(activityDone(mistake, { ...EMPTY, mistakes: { active: { q1: { lastWrongAt: BEFORE } }, reviewedAt: {} } }, startedAt)).toBe(false);
    expect(activityDone(glossary, { ...EMPTY, glossary: { tunduk: { lastReviewedAt: BEFORE } } }, startedAt)).toBe(false);
  });

  it('answered in Review after the start (right or wrong) / card reviewed after the start', () => {
    expect(activityDone(mistake, { ...EMPTY, mistakes: { active: {}, reviewedAt: { q1: LATER } } }, startedAt)).toBe(true);
    expect(activityDone(mistake, { ...EMPTY, mistakes: { active: { q1: { lastWrongAt: LATER } }, reviewedAt: {} } }, startedAt)).toBe(true);
    expect(activityDone(glossary, { ...EMPTY, glossary: { tunduk: { lastReviewedAt: LATER } } }, startedAt)).toBe(true);
  });

  it('path step: only when that step is completed; reading: finished or moved on', () => {
    expect(activityDone(step, { ...EMPTY, pathStates: { 'boz-uy': ['completed', 'in_progress'] } }, startedAt)).toBe(false);
    expect(activityDone(step, { ...EMPTY, pathStates: { 'boz-uy': ['completed', 'completed'] } }, startedAt)).toBe(true);
    expect(activityDone(reading, { ...EMPTY, reading: { 'culture_item:komuz-overview': { furthest: 0.35, completedAt: null } } }, startedAt)).toBe(false);
    expect(activityDone(reading, { ...EMPTY, reading: { 'culture_item:komuz-overview': { furthest: 0.45, completedAt: null } } }, startedAt)).toBe(true);
    expect(activityDone(reading, { ...EMPTY, reading: { 'culture_item:komuz-overview': { furthest: 0.3, completedAt: LATER } } }, startedAt)).toBe(true);
  });
});

describe('session flow', () => {
  const activities = buildStudySession(input, 'quick');

  it('skip, refresh, finish, summary', () => {
    let session = startSession('user-a', 'quick', activities, T0);
    expect(currentGroup(session).map((activity) => activity.refId)).toEqual(['q1', 'q2']);
    session = skipActivity(session, 'mistake:q1');
    expect(currentActivity(session)?.key).toBe('mistake:q2');
    const same = refreshSession(session, EMPTY);
    expect(same).toBe(session);
    session = refreshSession(session, { ...EMPTY, mistakes: { active: {}, reviewedAt: { q2: LATER } }, glossary: { tunduk: { lastReviewedAt: LATER } } });
    expect(isFinished(session)).toBe(true);
    expect(sessionSummary(endSession(session))).toEqual({ requested: 3, total: 3, completed: 2, skipped: 1, remaining: 0 });
    expect(endSession(session).endedEarly).toBe(false);
  });

  it('ending early keeps what was done and says so', () => {
    const ended = endSession(startSession('user-a', 'quick', activities, T0));
    expect(ended.endedEarly).toBe(true);
    expect(sessionSummary(ended)).toMatchObject({ completed: 0, skipped: 0, remaining: 3 });
    expect(endSession(ended)).toBe(ended);
  });

  it('a different account never continues the session', () => {
    const session = startSession('user-a', 'quick', activities, T0);
    expect(sessionFor(session, 'user-a')).toBe(session);
    expect(sessionFor(session, 'user-b')).toBeNull();
    expect(sessionFor(session, 'guest')).toBeNull();
  });
});

describe('Study Planner reminders', () => {
  it('sanitizes stored settings and only uses its own ids', () => {
    expect(sanitizeSettings({ enabled: true, days: [2, 2, 9, 4], hour: 30, minute: 5 })).toEqual({ enabled: true, days: [2, 4], hour: 18, minute: 5 });
    expect(sanitizeSettings('junk').enabled).toBe(false);
    expect(studyReminderIds([2, 4])).toEqual(['oyno-study-2', 'oyno-study-4']);
    const code = strip(fs.readFileSync(path.join(root, 'src/features/study/session/studyReminders.ts'), 'utf8'));
    expect(code).not.toMatch(/cancelAllScheduledNotificationsAsync|syncReminderSchedule/);
    expect(code).toContain('oynoStudy: true');
  });
});

describe('Focus Session wiring', () => {
  const read = (file: string) => strip(fs.readFileSync(path.join(root, file), 'utf8'));
  const screen = read('src/features/study/session/FocusSessionScreen.tsx');
  const model = read('src/features/study/session/focusSession.ts');

  it('reuses the existing engines and routes', () => {
    expect(fs.existsSync(path.join(root, 'src/app/study/session.tsx'))).toBe(true);
    expect(screen).toContain('<ChallengeRunScreen challengeId="review"');
    expect(screen).toContain('<GlossaryStudyScreen mode="review"');
    expect(screen).toContain('router.push(current.route');
  });

  it('records nothing itself: no Weekly Goal / XP / streak double counting', () => {
    for (const code of [screen, model, read('src/features/study/session/useCompletionSignals.ts')]) expect(code).not.toMatch(/useWeeklyGoalStore|recordActivity|addXp|\bxp\b|streak|recordFinishedAttempt|recordReviewAnswer|applyAnswer/i);
  });

  it('analytics events carry only the agreed fields', () => {
    const analytics = read('src/services/analytics/analytics.ts');
    for (const name of ['study_session_started', 'study_session_completed', 'study_session_ended_early']) {
      expect(analytics).toContain(`'${name}'`);
      expect(screen).toContain(`track('${name}', analyticsProps(`);
    }
    expect(screen).toMatch(/requested_size: summary\.requested, completed_count: summary\.completed, skipped_count: summary\.skipped/);
  });

  it('For You links to the session; Home gets no new section', () => {
    expect(read('src/features/home/forYou/ForYouCard.tsx')).toContain('FOCUS_SESSION_ROUTE');
    expect(read('src/features/home/homeSections.ts')).not.toMatch(/focus|studySession/i);
  });

  it('notification taps open only /study/session', () => {
    expect(read('src/components/system/ReminderSync.tsx')).toMatch(/study \? '\/study\/session'/);
  });

  it('strings exist in KG/RU/EN', () => {
    for (const locale of [en, ru, kg]) {
      const section = locale.studySession as Record<string, unknown>;
      for (const key of ['title', 'intro', 'introChild', 'start', 'skip', 'end', 'needsConnection', 'summaryTitle', 'summaryBody', 'startFocus', 'startFromForYou']) expect(section[key]).toBeTruthy();
    }
  });
});
