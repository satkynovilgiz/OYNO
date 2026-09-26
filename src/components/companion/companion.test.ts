import * as fs from 'fs';
import * as path from 'path';

import { ALL_CHARACTER_IDS, CHARACTERS_WITH_FULL_SHEET } from '@/components/character/characterAssets';
import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { getGameHostConfig } from '@games/gameHostCharacters';

import { COMPANION_LINES, companionLineKey, companionVisible, DEFAULT_COMPANION, emotionFor, resolveCompanion, type CompanionMomentType } from './companionModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const MOMENTS: CompanionMomentType[] = ['intro', 'hint', 'challenge', 'discovery', 'completion', 'encouragement', 'empty'];
const COMING_SOON = ALL_CHARACTER_IDS.filter((id) => !CHARACTERS_WITH_FULL_SHEET.includes(id));

function lookup(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict);
}

describe('companion selection', () => {
  it('keeps a valid chosen companion', () => {
    for (const id of CHARACTERS_WITH_FULL_SHEET) expect(resolveCompanion(id)).toBe(id);
  });

  it('falls back to the default for missing or unknown ids', () => {
    for (const id of [null, undefined, '', 'nobody', 'BEK']) expect(resolveCompanion(id)).toBe(DEFAULT_COMPANION);
    expect(CHARACTERS_WITH_FULL_SHEET).toContain(DEFAULT_COMPANION);
  });

  it('never presents a Coming Soon character (Бөрү / Тулпар / Элчи)', () => {
    expect(COMING_SOON.sort()).toEqual(['boru', 'elchi', 'tulpar']);
    for (const id of COMING_SOON) expect(resolveCompanion(id)).toBe(DEFAULT_COMPANION);
    const games = ['toguz-korgool', 'arkan-tartysh', 'zhaa-atuu', 'ordo', 'besh-tash', 'chuko', 'zholuk-tashtamay', 'cooking-world', 'beshbarmak-challenge', 'kyz-kuumay', 'ak-terek-kok-terek'];
    for (const gameId of games) expect(CHARACTERS_WITH_FULL_SHEET).toContain(getGameHostConfig(gameId)!.characterId);
  });
});

describe('companion copy', () => {
  const keys = Object.entries(COMPANION_LINES).flatMap(([surface, moments]) => Object.keys(moments).map((moment) => companionLineKey(surface as keyof typeof COMPANION_LINES, moment as CompanionMomentType)!));

  it('every surface/moment maps to an authored line in KG, RU and EN', () => {
    expect(keys.length).toBeGreaterThan(10);
    for (const key of keys) {
      for (const dict of [kg, ru, en]) {
        const text = lookup(dict, key);
        expect(typeof text).toBe('string');
        expect((text as string).trim()).toBeTruthy();
      }
    }
  });

  it('unmapped moments have no line (nothing is generated)', () => {
    expect(companionLineKey('emptySaved', 'intro')).toBeNull();
    expect(companionLineKey('daily', 'hint')).toBeNull();
  });

  it('Kyrgyz lines stay Kyrgyz, and no line judges the player', () => {
    for (const key of keys) {
      expect(lookup(kg, key)).not.toMatch(/[A-Za-z]/);
      const all = [kg, ru, en].map((dict) => (lookup(dict, key) as string).toLowerCase()).join(' ');
      expect(all).not.toMatch(/smart|clever|genius|stupid|wrong again|умн|гени|глуп|акылдуу|акылсыз/);
    }
  });

  it('Russian lines avoid gendered forms the companion or player could get wrong', () => {
    // (\b is ASCII-only, so the word end is spelled out for Cyrillic.)
    const gendered = /(?<![а-яё])(сделал|прошёл|прошел|готов|рад)(а|\(а\))?(?![а-яё])/i;
    expect('когда будешь готов(а)').toMatch(gendered);
    for (const key of keys) expect(lookup(ru, key)).not.toMatch(gendered);
  });
});

describe('companion behaviour', () => {
  it('emotion is deterministic per moment', () => {
    for (const moment of MOMENTS) {
      expect(emotionFor(moment)).toBe(emotionFor(moment));
      expect(['happy', 'laughing', 'angry', 'sad', 'surprised', 'focused', 'winking', 'thinking']).toContain(emotionFor(moment));
    }
    // Never angry or sad at the player.
    expect(MOMENTS.map(emotionFor)).not.toEqual(expect.arrayContaining(['angry']));
    expect(MOMENTS.map(emotionFor)).not.toEqual(expect.arrayContaining(['sad']));
  });

  it('presence follows the age experience', () => {
    for (const surface of Object.keys(COMPANION_LINES) as (keyof typeof COMPANION_LINES)[]) expect(companionVisible('child', surface)).toBe(true);
    for (const surface of ['daily', 'trail', 'challenge', 'journey', 'achievement'] as const) expect(companionVisible('adult', surface)).toBe(false);
    expect(companionVisible('teen', 'achievement')).toBe(false);
    for (const experience of ['child', 'preteen', 'teen', 'adult'] as const) {
      expect(companionVisible(experience, 'quest')).toBe(true);
      expect(companionVisible(experience, 'emptySaved')).toBe(true);
    }
  });

  it('the companion (CharacterAvatar) never replaces the player identity (UserAvatar)', () => {
    const source = fs.readFileSync(path.join(__dirname, 'CompanionMoment.tsx'), 'utf8');
    expect(source).toMatch(/CharacterAvatar/);
    expect(source).not.toMatch(/UserAvatar|avatarConfig/);
  });

  it('analytics carry only companion id, surface and moment; no haptics of its own', () => {
    const source = fs.readFileSync(path.join(__dirname, 'CompanionMoment.tsx'), 'utf8');
    expect(source).toMatch(/track\('companion_moment_shown', \{ companionId: companion, surface, moment \}\)/);
    expect(source).not.toMatch(/expo-haptics/);
  });
});
