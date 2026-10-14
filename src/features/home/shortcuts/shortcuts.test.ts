import * as fs from 'fs';
import * as path from 'path';

import AsyncStorage from '@react-native-async-storage/async-storage';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { HOME_SHORTCUTS_KEY, ownerShortcuts, useHomeShortcutsStore } from '@/store/useHomeShortcutsStore';
import { routeExists } from '@/test-utils/routeExists';

import { ACTIVITY_CATALOG, INTERESTS } from '../chooser/activityChooser';
import { applyPinChange, DEFAULT_PINS, MAX_PINS, normalizeShortcuts, pinnable, pinsOf, resolvePins } from './shortcutsModel';

const ROOT = path.join(__dirname, '../../../..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const all = () => true;

describe('Home shortcuts - the model', () => {
  it('default layout: four real catalogue activities, one per interest, every route exists', () => {
    expect(DEFAULT_PINS).toHaveLength(MAX_PINS);
    const activities = DEFAULT_PINS.map((id) => ACTIVITY_CATALOG.find((entry) => entry.id === id)!);
    expect(activities.every(Boolean)).toBe(true);
    expect(activities.map((activity) => activity.interest)).toEqual(INTERESTS);
    for (const activity of ACTIVITY_CATALOG) expect([activity.route, routeExists(activity.route)]).toEqual([activity.route, true]);
    expect(pinsOf(null)).toEqual([...DEFAULT_PINS]);
  });

  it('add (max four, catalogue ids only, no duplicates), remove, move, reset', () => {
    let stored = applyPinChange(null, { type: 'remove', id: 'jaaAtuu' });
    expect(pinsOf(stored)).toEqual(['daily', 'oymo', 'komuzListen']);
    expect(applyPinChange(stored, { type: 'add', id: 'not-an-activity' })).toBe(stored);
    expect(applyPinChange(stored, { type: 'add', id: 'oymo' })).toBe(stored);
    stored = applyPinChange(stored, { type: 'add', id: 'duel' });
    expect(pinsOf(stored)).toEqual(['daily', 'oymo', 'komuzListen', 'duel']);
    expect(applyPinChange(stored, { type: 'add', id: 'restore' })).toBe(stored);
    stored = applyPinChange(stored, { type: 'move', id: 'duel', delta: -1 });
    expect(pinsOf(stored)).toEqual(['daily', 'oymo', 'duel', 'komuzListen']);
    expect(applyPinChange(stored, { type: 'move', id: 'daily', delta: -1 })).toBe(stored);
    expect(applyPinChange(stored, { type: 'reset' })).toBeNull();
    expect(pinnable(pinsOf(stored)).some((activity) => activity.id === 'duel')).toBe(false);
  });

  it('removed or unknown destinations are kept in storage, never shown, reported and removable', () => {
    const stored = normalizeShortcuts({ pins: ['daily', 'retiredActivity', 'oymo', 42, 'daily', '<script>'] });
    expect(stored).toEqual({ pins: ['daily', 'retiredActivity', 'oymo'] });
    const { shown, unavailableIds } = resolvePins(pinsOf(stored), all);
    expect(shown.map((pin) => pin.activity.id)).toEqual(['daily', 'oymo']);
    expect(unavailableIds).toEqual(['retiredActivity']);
    expect(pinsOf(applyPinChange(stored, { type: 'removeUnavailable' }))).toEqual(['daily', 'oymo']);
    expect(normalizeShortcuts('garbage')).toBeNull();
  });

  it('offline: a shortcut whose screen can not open is shown as unavailable, not hidden', () => {
    const { shown } = resolvePins(['daily', 'oymo'], (route) => route !== '/daily');
    expect(shown.map((pin) => [pin.activity.id, pin.available])).toEqual([
      ['daily', false],
      ['oymo', true],
    ]);
  });
});

describe('Home shortcuts - storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useHomeShortcutsStore.setState({ status: 'idle', saved: {} });
  });

  it('per owner; reordering survives a reload; reset returns to the default', async () => {
    await useHomeShortcutsStore.getState().load();
    expect(await useHomeShortcutsStore.getState().change('user-a', { type: 'move', id: 'komuzListen', delta: -1 })).toBe(true);
    expect(await useHomeShortcutsStore.getState().change('guest', { type: 'remove', id: 'daily' })).toBe(true);
    useHomeShortcutsStore.setState({ status: 'idle', saved: {} });
    await useHomeShortcutsStore.getState().load();
    const saved = useHomeShortcutsStore.getState().saved;
    expect(pinsOf(ownerShortcuts(saved, 'user-a'))).toEqual(['daily', 'jaaAtuu', 'komuzListen', 'oymo']);
    expect(pinsOf(ownerShortcuts(saved, 'guest'))).toEqual(['jaaAtuu', 'oymo', 'komuzListen']);
    expect(pinsOf(ownerShortcuts(saved, 'user-b'))).toEqual([...DEFAULT_PINS]);
    expect(await useHomeShortcutsStore.getState().change('user-a', { type: 'reset' })).toBe(true);
    expect(JSON.parse((await AsyncStorage.getItem(HOME_SHORTCUTS_KEY))!)).toEqual({ guest: { pins: ['jaaAtuu', 'oymo', 'komuzListen'] } });
  });

  it('a failed write changes nothing and reports false', async () => {
    await useHomeShortcutsStore.getState().load();
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk full'));
    try {
      expect(await useHomeShortcutsStore.getState().change('guest', { type: 'remove', id: 'oymo' })).toBe(false);
    } finally {
      AsyncStorage.setItem = real;
    }
    expect(pinsOf(ownerShortcuts(useHomeShortcutsStore.getState().saved, 'guest'))).toEqual([...DEFAULT_PINS]);
  });

  it('unreadable storage: an error state that blocks writes (never overwritten); Retry reads it again', async () => {
    await AsyncStorage.setItem(HOME_SHORTCUTS_KEY, '{broken');
    await useHomeShortcutsStore.getState().load();
    expect(useHomeShortcutsStore.getState().status).toBe('error');
    expect(await useHomeShortcutsStore.getState().change('guest', { type: 'reset' })).toBe(false);
    expect(await AsyncStorage.getItem(HOME_SHORTCUTS_KEY)).toBe('{broken');
    await AsyncStorage.setItem(HOME_SHORTCUTS_KEY, JSON.stringify({ guest: { pins: ['duel'] } }));
    await useHomeShortcutsStore.getState().retryLoad();
    expect(pinsOf(ownerShortcuts(useHomeShortcutsStore.getState().saved, 'guest'))).toEqual(['duel']);
  });
});

describe('Home shortcuts - privacy, independence, strings', () => {
  it('labels come only from the catalogue titles (never a record); separate from learning progress', () => {
    const row = read('src/features/home/shortcuts/HomeShortcutsRow.tsx');
    expect(row).toMatch(/activity\.title \?\? t\(activity\.titleKey!\)/);
    expect(row).not.toMatch(/useJournal|useScrapbook|useQuestions|usePortfolio/);
    expect(read('src/store/useHomeShortcutsStore.ts')).not.toMatch(/useProgressStore|progress\//);
    expect(read('src/store/useProgressStore.ts')).not.toContain('homeShortcuts');
  });
  it('KG / RU / EN', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { homeShortcuts: Record<string, string> }).homeShortcuts;
      for (const key of ['title', 'edit', 'screenTitle', 'loadError', 'needsConnection', 'intro', 'moveUp', 'moveDown', 'remove', 'addOne', 'saveFailed', 'reset', 'resetTitle', 'resetMessage', 'resetConfirm', 'unavailable_one', 'unavailable_few', 'pinned_other']) expect([key, !!block[key]?.trim()]).toEqual([key, true]);
    }
  });
});
