/**
 * Content integrity (not prose style): every string a person can read
 * exists in all three languages, is not empty, and carries no leftover
 * placeholder / developer markers; every game and destination has a
 * localized name. Complements localeParity.test.ts (which checks keys
 * and scripts).
 */
import * as fs from 'fs';
import * as path from 'path';

import { collections } from '@/features/collections/collectionsData';
import { cultureCategoryImages } from '@/features/culture/data';
import { mockGamesList } from '@/features/games/mockData';
import { gameTitleKey } from '@/features/games/types';
import { trails } from '@/features/trails/trailsData';
import { cultureCategoryTitle, LOCALIZED_CATEGORY_IDS } from '@/services/content/cultureCategoryTitles';
import { LOCALIZED_TAGLINE_IDS, regionTagline } from '@/services/content/regionTaglines';

import en from './locales/en.json';
import kg from './locales/kg.json';
import ru from './locales/ru.json';

const LOCALES = { en, ru, kg } as const;
const LANGS = ['kg', 'ru', 'en'] as const;

function walk(value: unknown, prefix = ''): [string, string][] {
  if (typeof value === 'string') return [[prefix, value]];
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, child]) => walk(child, prefix ? `${prefix}.${key}` : key));
  return [];
}

function lookup(locale: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], locale);
}

describe('content integrity', () => {
  it('no empty translated strings', () => {
    for (const [name, locale] of Object.entries(LOCALES)) {
      const empty = walk(locale).filter(([, value]) => value.trim() === '');
      expect({ name, empty }).toEqual({ name, empty: [] });
    }
  });

  it('no leftover placeholder or developer markers', () => {
    const marker = /\b(TODO|TBD|FIXME|lorem|ipsum|XXX)\b|\?\?\?|\[placeholder\]/i;
    for (const [name, locale] of Object.entries(LOCALES)) {
      const hits = walk(locale).filter(([, value]) => marker.test(value));
      expect({ name, hits }).toEqual({ name, hits: [] });
    }
  });

  it('every game has a real title in KG, RU and EN (never the raw key)', () => {
    for (const game of mockGamesList) {
      for (const [name, locale] of Object.entries(LOCALES)) {
        const title = lookup(locale, gameTitleKey(game.id));
        expect({ game: game.id, name, ok: typeof title === 'string' && title.trim().length > 0 }).toEqual({ game: game.id, name, ok: true });
      }
    }
  });

  it('trails and collections are titled and introduced in all three languages', () => {
    for (const item of [...trails, ...collections]) {
      for (const lang of LANGS) {
        expect(item.title[lang]?.trim()).toBeTruthy();
        expect(item.intro[lang]?.trim()).toBeTruthy();
      }
    }
  });

  it('every Explore destination has RU/EN taglines (the DB column is Kyrgyz-only)', () => {
    const destinationIds = fs
      .readdirSync(path.join(__dirname, '../../content/explore'))
      .filter((file) => file.endsWith('.md') && file === file.toLowerCase() && !file.startsWith('RESEARCH'))
      .map((file) => file.replace(/\.md$/, ''));
    expect(destinationIds.length).toBe(14);
    expect([...LOCALIZED_TAGLINE_IDS].sort()).toEqual([...destinationIds].sort());
    // Kyrgyz always comes from the database row itself.
    expect(regionTagline({ id: 'osh', tagline: 'DB' }, 'kg')).toBe('DB');
    expect(regionTagline({ id: 'osh', tagline: 'DB' }, 'ru')).not.toBe('DB');
  });

  it('every culture category has RU/EN names (the DB title is Kyrgyz-only)', () => {
    expect([...LOCALIZED_CATEGORY_IDS].sort()).toEqual(Object.keys(cultureCategoryImages).sort());
    expect(cultureCategoryTitle({ id: 'tradition', title: 'Каада-салт' }, 'kg')).toBe('Каада-салт');
    expect(cultureCategoryTitle({ id: 'tradition', title: 'Каада-салт' }, 'en')).toBe('Customs and traditions');
  });
});
