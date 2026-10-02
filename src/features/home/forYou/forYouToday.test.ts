import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import { isDismissedToday, pickForYou, type ForYouInput } from './forYouToday';

const BASE: ForYouInput = {
  isNewUser: false,
  unfinishedReading: null,
  activePath: null,
  mistakesWaiting: 0,
  glossaryWaiting: 0,
  dailyChallengeDone: true,
  firstUnstartedPath: null,
  beginnerPath: { title: 'Discover the Boz Üy', route: '/learn/boz-uy', image: null },
  excludedRoutes: [],
};
const reading = { title: 'Боз үй', percent: 62, route: '/culture/item/boz-uy-overview', image: null };

describe('For You Today - priority', () => {
  it('brand-new user -> the curated beginner path (not fake personalization)', () => {
    expect(pickForYou({ ...BASE, isNewUser: true, dailyChallengeDone: false })).toMatchObject({ reason: 'beginner', route: '/learn/boz-uy' });
  });

  it('unfinished reading wins over everything else', () => {
    expect(pickForYou({ ...BASE, unfinishedReading: reading, activePath: { title: 'P', completed: 1, total: 5, route: '/learn/x', image: null }, mistakesWaiting: 3, dailyChallengeDone: false })).toMatchObject({ reason: 'continue_reading', count: 62 });
  });

  it('then an active learning path, then mistakes, then glossary, then daily', () => {
    expect(pickForYou({ ...BASE, activePath: { title: 'P', completed: 1, total: 5, route: '/learn/x', image: null }, mistakesWaiting: 3 }).reason).toBe('continue_learning_path');
    expect(pickForYou({ ...BASE, mistakesWaiting: 3, glossaryWaiting: 2 })).toMatchObject({ reason: 'review_mistakes', count: 3 });
    expect(pickForYou({ ...BASE, glossaryWaiting: 2, dailyChallengeDone: false })).toMatchObject({ reason: 'review_glossary', count: 2 });
    expect(pickForYou({ ...BASE, dailyChallengeDone: false }).reason).toBe('daily_challenge');
  });

  it('nothing pending -> start a path, else discover something new', () => {
    expect(pickForYou({ ...BASE, firstUnstartedPath: { title: 'Felt', route: '/learn/felt-oymo', image: null } }).reason).toBe('start_path');
    expect(pickForYou(BASE)).toMatchObject({ reason: 'discover', route: '/culture/gallery' });
  });

  it('never repeats what the Home hero already shows', () => {
    expect(pickForYou({ ...BASE, dailyChallengeDone: false, mistakesWaiting: 2, excludedRoutes: ['/challenges/review'] }).reason).toBe('daily_challenge');
    // ...nor the path the Learning Paths card already shows.
    expect(pickForYou({ ...BASE, isNewUser: true, dailyChallengeDone: false, excludedRoutes: ['/learn/boz-uy'] }).reason).toBe('daily_challenge');
  });

  it('deterministic: same input, same card', () => {
    const input = { ...BASE, glossaryWaiting: 4, dailyChallengeDone: false };
    expect(pickForYou(input)).toEqual(pickForYou(input));
  });

  it('"Not now" hides it for the rest of that day only', () => {
    expect(isDismissedToday('2026-10-02', '2026-10-02')).toBe(true);
    expect(isDismissedToday('2026-10-01', '2026-10-02')).toBe(false);
    expect(isDismissedToday(null, '2026-10-02')).toBe(false);
  });

  it('no private text, no randomness, no region bias; per-owner hook', () => {
    const model = fs.readFileSync(path.join(__dirname, 'forYouToday.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(model).not.toMatch(/Math\.random|note|journal|excerpt|region/i);
    const hook = fs.readFileSync(path.join(__dirname, 'useForYouToday.ts'), 'utf8');
    expect(hook).not.toMatch(/useJournalStore|useHighlightsStore|excerpt/);
    expect(hook).toMatch(/usePathSignals\(\)/);
  });

  it('KG / RU / EN strings for every reason', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { forYou: { title: string; notNow: string; reason: Record<string, Record<string, string>> } }).forYou;
      expect(block.title && block.notNow).toBeTruthy();
      for (const reason of ['beginner', 'continue_reading', 'continue_learning_path', 'review_mistakes', 'review_glossary', 'daily_challenge', 'start_path', 'discover']) {
        expect(block.reason[reason].heading ?? block.reason[reason].heading_other).toBeTruthy();
      }
    }
  });
});
