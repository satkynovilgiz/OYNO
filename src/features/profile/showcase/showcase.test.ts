import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { ownerPins, useAchievementShowcaseStore } from '@/store/useAchievementShowcaseStore';

import { MAX_PINS, mergePins, movePin, pin, sanitizePins, unpin, visiblePins } from './showcaseModel';

const EARNED = ['first-win', 'traveler', 'boz-uy-guest', 'komuzchu'];
const CATALOG = ['first-win', 'traveler', 'boz-uy-guest', 'komuzchu'];
const ui = fs.readFileSync(path.join(__dirname, 'AchievementShowcase.tsx'), 'utf8');

describe('Achievement Showcase', () => {
  it('max 3 pins', () => {
    let pins: string[] = [];
    for (const id of EARNED) pins = pin(pins, id, EARNED);
    expect(pins).toEqual(['first-win', 'traveler', 'boz-uy-guest']);
    expect(MAX_PINS).toBe(3);
    expect(sanitizePins(['a', 'b', 'c', 'd'])).toHaveLength(3);
  });

  it('only earned achievements can be pinned; no duplicates', () => {
    expect(pin([], 'komuzchu', ['first-win'])).toEqual([]);
    expect(pin(['first-win'], 'first-win', EARNED)).toEqual(['first-win']);
  });

  it('unpin and reorder (left/right; ends are no-ops)', () => {
    expect(unpin(['a', 'b'], 'a')).toEqual(['b']);
    expect(movePin(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(movePin(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(movePin(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
  });

  it('a removed or no-longer-earned achievement disappears safely (no broken card)', () => {
    expect(visiblePins(['first-win', 'deleted-achievement', 'traveler'], EARNED, CATALOG)).toEqual(['first-win', 'traveler']);
    expect(visiblePins(['first-win', 'traveler'], ['traveler'], CATALOG)).toEqual(['traveler']);
    expect(ui).toMatch(/if \(progressLoaded && pins\.length !== stored\.length\)/);
  });

  it('guest persistence, guest -> account (validated on display), no A -> B leak', () => {
    useAchievementShowcaseStore.setState({ saved: {}, isLoaded: true });
    useAchievementShowcaseStore.getState().setPins('guest', ['komuzchu']);
    useAchievementShowcaseStore.getState().setPins('user-a', ['first-win', 'traveler']);
    useAchievementShowcaseStore.getState().adoptGuest('user-a');
    expect(ownerPins(useAchievementShowcaseStore.getState().saved, 'user-a')).toEqual(['first-win', 'traveler', 'komuzchu']);
    expect(ownerPins(useAchievementShowcaseStore.getState().saved, 'guest')).toEqual([]);
    expect(ownerPins(useAchievementShowcaseStore.getState().saved, 'user-b')).toEqual([]);
    // If the account hasn't earned an adopted pin, it simply isn't shown.
    expect(visiblePins(ownerPins(useAchievementShowcaseStore.getState().saved, 'user-a'), ['first-win', 'traveler'], CATALOG)).toEqual(['first-win', 'traveler']);
    expect(mergePins(['a', 'b'], ['b', 'c', 'd'])).toEqual(['a', 'b', 'c']);
    const lifecycle = fs.readFileSync(path.join(__dirname, '../../../services/sync/accountLifecycle.ts'), 'utf8');
    expect(lifecycle).toMatch(/useAchievementShowcaseStore\.getState\(\)\.adoptGuest\(userId\)/);
  });

  it('stores ids only - no duplicated titles/artwork', () => {
    const store = fs.readFileSync(path.join(__dirname, '../../../store/useAchievementShowcaseStore.ts'), 'utf8');
    expect(store).not.toMatch(/titleKey|iconSource|requirementKey/);
  });

  it('share card: artworks + titles + OYNO only - no email, account id, rank or progress', () => {
    const share = ui.slice(ui.indexOf('export function buildShowcaseShareCard'), ui.indexOf('/** /profile/achievements/showcase'));
    expect(share).not.toMatch(/\b(email|userId|rank|xp|level|journal)\b|user\.id/i);
    for (const call of ui.match(/track\([^)]*\)/g) ?? []) expect(call).toMatch(/track\('(achievement_pinned|achievement_unpinned|achievement_showcase_shared)'(, \{ achievement_id: id \})?\)/);
  });

  it('age presentation: same pins, badge size by age; nothing earned -> no empty showcase', () => {
    expect(ui).toMatch(/const BADGE: Record<AgeExperience, number> = \{ child: 84, preteen: 72, teen: 60, adult: 48 \}/);
    expect(ui).toMatch(/if \(earnedIds\.length === 0\) return null;/);
  });

  it('unlock modal offers "Add to Showcase" only with a free slot, never pins automatically', () => {
    const modal = fs.readFileSync(path.join(__dirname, '../components/AchievementUnlockedModal.tsx'), 'utf8');
    expect(modal).toMatch(/showcase\.pins\.length < MAX_PINS/);
    expect(modal.match(/showcase\.pin\(/g)).toHaveLength(1);
    expect(modal).toMatch(/onPress=\{\(\) => \{\s*showcase\.pin\(achievement!\.id\);/);
  });

  it('no competition wording', () => {
    for (const dict of [en, ru, kg]) expect(JSON.stringify((dict as unknown as { showcase: unknown }).showcase)).not.toMatch(/top |best|rare|лучш|редк|мыкты/i);
  });

  it('KG / RU / EN', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { showcase: Record<string, string> }).showcase;
      for (const key of ['title', 'choose', 'edit', 'pin', 'unpin', 'pinned', 'selected', 'moveLeft', 'moveRight', 'share', 'noneEarned']) expect(block[key]).toBeTruthy();
    }
  });
});
