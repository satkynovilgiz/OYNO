import AsyncStorage from '@react-native-async-storage/async-storage';
import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { HOME_LAYOUT_KEY, useHomeLayoutStore } from '@/store/useHomeLayoutStore';

import { DEFAULT_LAYOUT, isCustomized, moveSection, orderedSections, sanitizeLayout, setShown, visibleSections } from './homeLayout';
import { ALL_HOME_SECTIONS, getHomeSectionOrder } from './homeSections';

describe('Customize Home', () => {
  it('default: exactly the age order (unchanged)', () => {
    for (const age of ['child', 'preteen', 'teen', 'adult'] as const) expect(visibleSections(age, DEFAULT_LAYOUT)).toEqual(getHomeSectionOrder(age));
  });

  it('hides an optional section; the hero can never be hidden or duplicated', () => {
    const prefs = setShown(DEFAULT_LAYOUT, 'games', false);
    expect(visibleSections('adult', prefs)).not.toContain('games');
    expect(setShown(DEFAULT_LAYOUT, 'hero', false)).toBe(DEFAULT_LAYOUT);
    expect(sanitizeLayout({ order: ['hero', 'games', 'games'], hidden: ['hero'] })).toEqual({ order: ['hero', 'games'], hidden: [] });
    const all = ALL_HOME_SECTIONS.filter((id) => id !== 'hero').reduce((p, id) => setShown(p, id, false), DEFAULT_LAYOUT);
    expect(visibleSections('adult', all)).toEqual(['hero']);
    expect(visibleSections('teen', { order: ['games', 'hero', 'culture'], hidden: [] }).filter((id) => id === 'hero')).toEqual(['hero']);
    expect(visibleSections('teen', { order: ['games', 'hero', 'culture'], hidden: [] })[0]).toBe('hero');
  });

  it('reorders with move up / move down; hero stays first; ends are no-ops', () => {
    let prefs = moveSection(DEFAULT_LAYOUT, 'adult', 'games', -1);
    const order = orderedSections('adult', prefs);
    expect(order.indexOf('games')).toBe(getHomeSectionOrder('adult').indexOf('games') - 1);
    expect(order[0]).toBe('hero');
    prefs = moveSection(prefs, 'adult', 'culture', -1);
    expect(orderedSections('adult', prefs)[1]).toBe('culture');
    expect(moveSection(prefs, 'adult', 'hero', 1)).toBe(prefs);
    expect(new Set(orderedSections('adult', prefs)).size).toBe(orderedSections('adult', prefs).length);
  });

  it('reset returns to the age default', async () => {
    useHomeLayoutStore.getState().set(setShown(DEFAULT_LAYOUT, 'games', false));
    expect(isCustomized(useHomeLayoutStore.getState().prefs, 'adult')).toBe(true);
    useHomeLayoutStore.getState().reset();
    expect(useHomeLayoutStore.getState().prefs).toEqual(DEFAULT_LAYOUT);
    expect(await AsyncStorage.getItem(HOME_LAYOUT_KEY)).toBeNull();
  });

  it('unknown / stale ids in storage are ignored, never crash', () => {
    const prefs = sanitizeLayout({ order: ['games', 'regionMap', 42, null, 'culture'], hidden: ['oldSection', 'recent'] });
    expect(prefs).toEqual({ order: ['games', 'culture'], hidden: ['recent'] });
    expect(sanitizeLayout('garbage')).toEqual(DEFAULT_LAYOUT);
    expect(() => visibleSections('adult', prefs)).not.toThrow();
  });

  it('a section the stored order doesn’t know (new app version) appears shown at its default place', () => {
    const stored = { order: getHomeSectionOrder('adult').filter((id) => id !== 'paths' && id !== 'hero').reverse(), hidden: [] };
    const order = orderedSections('adult', stored);
    expect(order).toContain('paths');
    // Inserted right after its default predecessor ('continue').
    expect(order.indexOf('paths')).toBe(order.indexOf('continue') + 1);
  });

  it('age change keeps compatible preferences; sections of the new age use default placement', () => {
    // Child has no 'recent'; adult does.
    let prefs = setShown(DEFAULT_LAYOUT, 'games', false);
    prefs = moveSection(prefs, 'child', 'dailyRow', -1);
    const adult = orderedSections('adult', prefs);
    expect(adult).toContain('recent');
    expect(visibleSections('adult', prefs)).not.toContain('games');
    expect(adult.indexOf('recent')).toBe(adult.indexOf('paths') + 1);
    // Back to child: 'recent' isn't part of the child Home - ignored, no crash.
    expect(visibleSections('child', { ...prefs, hidden: [...prefs.hidden, 'recent'] })).not.toContain('recent');
  });

  it('zero-content sections keep hiding themselves even when enabled', () => {
    const home = fs.readFileSync(path.join(__dirname, 'HomeScreen.tsx'), 'utf8');
    expect(home).toMatch(/case 'recent':\s*return recent\.length > 0 \?/);
    expect(home).toMatch(/visibleSections\(experience, homeLayout\)\.map/);
  });

  it('persists on the device (no backend)', async () => {
    useHomeLayoutStore.getState().set(setShown(DEFAULT_LAYOUT, 'progress', false));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(JSON.parse((await AsyncStorage.getItem(HOME_LAYOUT_KEY))!)).toEqual({ order: null, hidden: ['progress'] });
    useHomeLayoutStore.setState({ isLoaded: false, prefs: DEFAULT_LAYOUT });
    await useHomeLayoutStore.getState().load();
    expect(useHomeLayoutStore.getState().prefs.hidden).toEqual(['progress']);
    const store = fs.readFileSync(path.join(__dirname, '../../store/useHomeLayoutStore.ts'), 'utf8');
    expect(store).not.toMatch(/supabase/);
  });

  it('KG / RU / EN: every section and control is named', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { customizeHome: Record<string, unknown> }).customizeHome;
      for (const key of ['title', 'shown', 'hidden', 'moveUp', 'moveDown', 'reset', 'defaultLayout', 'sectionsTitle', 'immediate']) expect(block[key]).toBeTruthy();
      for (const id of ALL_HOME_SECTIONS) expect((block.sections as Record<string, string>)[id]).toBeTruthy();
    }
    expect((en as unknown as { customizeHome: { moveUp: string } }).customizeHome.moveUp.replace('{{name}}', 'Games')).toBe('Move Games up');
  });
});
