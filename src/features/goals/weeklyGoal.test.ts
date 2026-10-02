import * as fs from 'fs';
import * as path from 'path';

import AsyncStorage from '@react-native-async-storage/async-storage';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { ownerGoal, useWeeklyGoalStore } from '@/store/useWeeklyGoalStore';

import { activitiesThisWeek, collectActivityEvents, goalState, weekKey, weekStart } from './weeklyGoal';

const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0);

describe('Weekly goal - what counts', () => {
  const events = collectActivityEvents({
    readings: [
      { contentType: 'culture_item', contentId: 'a', completedAt: local(2026, 9, 29).toISOString() },
      { contentType: 'culture_item', contentId: 'b', completedAt: null },
    ],
    challengeResults: { 'daily:2026-09-30': { completedAt: local(2026, 9, 30).toISOString() }, journey: { completedAt: null } },
    glossarySessions: [local(2026, 10, 1).toISOString()],
    manualPathSteps: { 'boz-uy': { build: local(2026, 10, 2).toISOString() } },
    gameSessions: [
      { id: 'g1', completedAt: local(2026, 10, 2).toISOString(), practice: false },
      { id: 'g2', completedAt: local(2026, 10, 2).toISOString(), practice: true },
    ],
  });

  it('only real completions count (unfinished reading, unfinished challenge, practice rounds do not)', () => {
    expect(events.map((event) => event.kind).sort()).toEqual(['challenge', 'game', 'glossary', 'path_step', 'reading']);
  });

  it('opens/searches/saves are not event sources at all', () => {
    const model = fs.readFileSync(path.join(__dirname, 'weeklyGoal.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(model).not.toMatch(/favorite|search|share|gallery|opened/i);
  });

  it('each completion counts once', () => {
    expect(activitiesThisWeek([...events, events[0]], local(2026, 10, 2))).toHaveLength(5);
  });

  it('week = Monday 00:00 -> next Monday, local time', () => {
    expect(weekStart(local(2026, 10, 4, 23)).getDay()).toBe(1); // Sunday belongs to the week of Monday 28 Sep
    expect(weekKey(local(2026, 10, 4, 23))).toBe('2026-09-28');
    expect(weekKey(local(2026, 10, 5, 0))).toBe('2026-10-05');
    const sundayNight = { id: 'x', kind: 'reading' as const, at: local(2026, 10, 4, 23).toISOString() };
    const mondayMorning = { id: 'y', kind: 'reading' as const, at: local(2026, 10, 5, 0).toISOString() };
    expect(activitiesThisWeek([sundayNight, mondayMorning], local(2026, 10, 5, 9)).map((event) => event.id)).toEqual(['y']);
  });

  it('changing the goal mid-week keeps the count; no goal -> nothing shown; a new week simply restarts (no streak)', () => {
    const now = local(2026, 10, 2);
    expect(goalState(3, events, now)).toEqual({ goal: 3, done: 5, complete: true });
    expect(goalState(7, events, now)).toEqual({ goal: 7, done: 5, complete: false });
    expect(goalState(null, events, now)).toBeNull();
    expect(goalState(5, events, local(2026, 10, 7))?.done).toBe(0);
  });

  it('no streaks, no rewards, no shaming', () => {
    const code = ['weeklyGoal.ts', 'useWeeklyGoal.ts', 'WeeklyGoalScreen.tsx'].map((file) => fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')).join('\n');
    expect(code).not.toMatch(/streak|addXp|addCoins|badge|achievement/i);
    for (const dict of [en, ru, kg]) expect(JSON.stringify((dict as { weeklyGoal: unknown }).weeklyGoal)).not.toMatch(/streak|you lost|lose your|break your|серия|потерял|үзүлдү/i);
  });
});

describe('Weekly goal - per owner', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useWeeklyGoalStore.setState({ isLoaded: false, saved: {} });
  });

  it('guest goal persists; adopted only when the account has none; disabling keeps nothing else', async () => {
    await useWeeklyGoalStore.getState().load();
    useWeeklyGoalStore.getState().setGoal('guest', 5);
    await new Promise((resolve) => setTimeout(resolve, 0));
    useWeeklyGoalStore.setState({ isLoaded: false, saved: {} });
    await useWeeklyGoalStore.getState().load();
    expect(ownerGoal(useWeeklyGoalStore.getState().saved, 'guest').goal).toBe(5);
    useWeeklyGoalStore.getState().setGoal('user-a', 3);
    useWeeklyGoalStore.getState().adoptGuest('user-a');
    expect(ownerGoal(useWeeklyGoalStore.getState().saved, 'user-a').goal).toBe(3);
    expect(ownerGoal(useWeeklyGoalStore.getState().saved, 'user-b').goal).toBeNull();
    useWeeklyGoalStore.getState().setGoal('user-a', null);
    expect(ownerGoal(useWeeklyGoalStore.getState().saved, 'user-a').goal).toBeNull();
  });

  it('KG / RU / EN strings', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { weeklyGoal: Record<string, string> }).weeklyGoal;
      for (const key of ['title', 'thisWeek', 'set', 'option_other', 'complete', 'none', 'change']) expect(block[key]).toBeTruthy();
    }
  });
});
