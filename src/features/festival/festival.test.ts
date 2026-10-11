import { ACTIVITY_CATALOG } from '@/features/home/chooser/activityChooser';

import { activityById, currentSession, estimate, FESTIVAL_SETS, GUEST_ACTIVITIES, isComplete, keepSession, LENGTHS, needsConfirmToEnd, planSet, sessionReducer, setsFor, startSession, summary } from './festivalModel';

const all = () => true;
const set = (id: string) => FESTIVAL_SETS.find((entry) => entry.id === id)!;

describe('festival sets', () => {
  it('every length has at least one set of 2-3 guest activities', () => {
    for (const length of LENGTHS) expect(setsFor(length).length).toBeGreaterThan(0);
    for (const entry of FESTIVAL_SETS) {
      expect(entry.activityIds.length).toBeGreaterThanOrEqual(2);
      expect(entry.activityIds.length).toBeLessThanOrEqual(3);
      for (const id of entry.activityIds) expect(GUEST_ACTIVITIES as readonly string[]).toContain(id);
    }
  });
  it('estimates stay within the chosen length', () => {
    for (const entry of FESTIVAL_SETS) expect(estimate(entry)).toBeLessThanOrEqual(entry.length + 1);
  });
  it('only guest activities that keep nothing private are used', () => {
    for (const id of GUEST_ACTIVITIES) {
      const activity = activityById(id);
      expect(activity).not.toBeNull();
      expect(activity!.repeat).toBe('repeatable');
    }
    for (const excluded of ['daily', 'oymo', 'komuzLesson']) expect(GUEST_ACTIVITIES as readonly string[]).not.toContain(excluded);
    expect(ACTIVITY_CATALOG.length).toBeGreaterThan(GUEST_ACTIVITIES.length);
  });
});

describe('unavailable activities', () => {
  it('replaces one with an available activity of the same interest and says so', () => {
    const plan = planSet(set('quick-discover'), (route) => route !== '/culture/detective');
    expect(plan[0]).toEqual({ id: 'mapChallenge', replaces: 'detective', available: true });
    expect(activityById(plan[0].id)!.interest).toBe(activityById('detective')!.interest);
  });
  it('keeps it marked unavailable when nothing similar can open', () => {
    const plan = planSet(set('make-and-listen'), (route) => !route.startsWith('/culture/komuz'));
    expect(plan[1]).toEqual({ id: 'repeatRhythm', replaces: null, available: false });
  });
  it('never repeats an activity already in the set', () => {
    const plan = planSet(set('quick-play'), (route) => route !== '/games/jaa-atuu');
    expect(new Set(plan.map((entry) => entry.id)).size).toBe(plan.length);
  });
});

describe('session transitions', () => {
  it('open -> next -> open -> next completes; summary lists explored only', () => {
    let session = startSession(set('quick-play'), 'en', 'kg', all);
    expect(session.items.map((item) => item.status)).toEqual(['waiting', 'waiting']);
    session = sessionReducer(session, { type: 'open', index: 0 });
    expect(session.items[0].status).toBe('started');
    session = sessionReducer(session, { type: 'next' });
    expect(session.current).toBe(1);
    session = sessionReducer(session, { type: 'open', index: 1 });
    session = sessionReducer(session, { type: 'next' });
    expect(isComplete(session)).toBe(true);
    expect(summary(session)).toEqual(['jaaAtuu', 'kyzKuumai']);
  });
  it('skipping is not exploring', () => {
    let session = startSession(set('quick-play'), 'kg', 'kg', all);
    session = sessionReducer(session, { type: 'skip' });
    session = sessionReducer(session, { type: 'open', index: 1 });
    session = sessionReducer(session, { type: 'next' });
    expect(session.items.map((item) => item.status)).toEqual(['skipped', 'explored']);
    expect(summary(session)).toEqual(['kyzKuumai']);
  });
  it('an unavailable activity cannot be opened and is passed over', () => {
    let session = startSession(set('make-and-listen'), 'kg', 'kg', (route) => !route.startsWith('/culture/komuz'));
    expect(sessionReducer(session, { type: 'open', index: 1 })).toBe(session);
    session = sessionReducer(sessionReducer(session, { type: 'open', index: 0 }), { type: 'next' });
    expect(isComplete(session)).toBe(true);
    expect(summary(session)).toEqual(['bozUy']);
  });
  it('confirms before ending while a shared-device activity is open', () => {
    let session = startSession(set('together-10'), 'kg', 'kg', all);
    expect(needsConfirmToEnd(session)).toBe(false);
    session = sessionReducer(session, { type: 'open', index: 0 });
    expect(activityById('duel')!.together).toBe(true);
    expect(needsConfirmToEnd(session)).toBe(true);
    session = sessionReducer(session, { type: 'next' });
    expect(needsConfirmToEnd(session)).toBe(false);
  });
  it('keeps both languages so the app language is restored', () => {
    const session = startSession(set('quick-play'), 'en', 'ru', all);
    expect([session.language, session.previousLanguage]).toEqual(['en', 'ru']);
  });
});

describe('cleanup', () => {
  it('the in-memory session is cleared at the end; the summary holds ids only', () => {
    const session = sessionReducer(startSession(set('quick-play'), 'kg', 'kg', all), { type: 'open', index: 0 });
    keepSession(session);
    expect(currentSession()).toBe(session);
    const explored = summary(sessionReducer(session, { type: 'next' }));
    keepSession(null);
    expect(currentSession()).toBeNull();
    expect(explored.every((id) => GUEST_ACTIVITIES.includes(id as never))).toBe(true);
  });
});
