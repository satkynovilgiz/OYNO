import * as fs from 'fs';
import * as path from 'path';

import AsyncStorage from '@react-native-async-storage/async-storage';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import type { CultureItemRow } from '@/services/content/types';
import { ownerStudy, useGlossaryStudyStore } from '@/store/useGlossaryStudyStore';

import { GLOSSARY } from '../glossaryData';
import { resolveGlossary } from '../glossaryModel';
import { seededCultureItems } from '../seededCultureItems';
import { applyAnswer, buildSession, DEFAULT_SESSION_SIZE, mergeStudy, pruneStudy, reviewQueue, sessionSummary, type StudyData } from './glossaryStudy';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const ROOT = path.join(__dirname, '../../../../..');
const ROWS = [...seededCultureItems(ROOT).values()] as unknown as CultureItemRow[];
const VALID = resolveGlossary(ROWS).map(({ entry }) => entry.id);
const at = (minutes: number) => new Date(Date.UTC(2026, 9, 2, 10, minutes));
const screen = fs.readFileSync(path.join(__dirname, 'GlossaryStudyScreen.tsx'), 'utf8');

describe('Glossary flashcards - sessions', () => {
  it('cards come only from valid resolved glossary entries, no duplicates', () => {
    expect(VALID).toEqual(GLOSSARY.map((entry) => entry.id));
    const all = buildSession([...VALID, VALID[0]], {}, 'all', 7);
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual([...VALID].sort());
    // A removed entry never becomes a card, even with an old record.
    const withStale = applyAnswer({}, 'gone-term', 'review_again', at(0));
    expect(buildSession(VALID, withStale, 'all', 7)).not.toContain('gone-term');
    expect(pruneStudy(withStale, VALID)).toEqual({});
  });

  it('5-card session by default; fewer cards -> all of them', () => {
    expect(DEFAULT_SESSION_SIZE).toBe(5);
    expect(buildSession(VALID, {}, 'five', 1)).toHaveLength(5);
    expect(buildSession(VALID.slice(0, 3), {}, 'five', 1)).toHaveLength(3);
  });

  it('first session: deterministic shuffle for a seed (not random-only)', () => {
    expect(buildSession(VALID, {}, 'all', 42)).toEqual(buildSession(VALID, {}, 'all', 42));
    expect(buildSession(VALID, {}, 'all', 42)).not.toEqual(VALID);
  });

  it('returning: Review-again terms first, then never-studied, then least recently reviewed', () => {
    let data: StudyData = {};
    for (const [index, id] of VALID.entries()) data = applyAnswer(data, id, 'got_it', at(index));
    data = applyAnswer(data, VALID[7], 'review_again', at(50));
    data = applyAnswer(data, VALID[3], 'review_again', at(40));
    const session = buildSession(VALID, data, 'all', 1);
    expect(session.slice(0, 2)).toEqual([VALID[3], VALID[7]]);
    expect(session[2]).toBe(VALID.filter((id) => id !== VALID[3] && id !== VALID[7])[0]);
    expect(buildSession(VALID, data, 'review', 1)).toEqual([VALID[3], VALID[7]]);
  });

  it('Got it clears the flag; Review again sets it; counts and dates kept (no definition text)', () => {
    let data = applyAnswer({}, 'tunduk', 'review_again', at(0));
    expect(data.tunduk).toEqual({ glossaryEntryId: 'tunduk', seenCount: 1, gotItCount: 0, reviewAgainCount: 1, lastReviewedAt: at(0).toISOString(), needsReview: true });
    data = applyAnswer(data, 'tunduk', 'got_it', at(1));
    expect(data.tunduk).toMatchObject({ seenCount: 2, gotItCount: 1, needsReview: false });
    expect(reviewQueue(data, VALID)).toEqual([]);
    expect(JSON.stringify(data)).not.toMatch(/Боз үйдүн|definition/);
  });

  it('session summary: plain counts, no grade or percentage', () => {
    expect(sessionSummary(['got_it', 'review_again', 'got_it'])).toEqual({ reviewed: 3, gotIt: 2, reviewAgain: 1 });
    expect(screen.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/percent|mastered|grade|score/i);
  });
});

describe('Glossary flashcards - accounts, isolation, presentation', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useGlossaryStudyStore.setState({ isLoaded: false, saved: {} });
  });

  it('guest persistence; guest -> account merge; A never seen by B', async () => {
    await useGlossaryStudyStore.getState().load();
    useGlossaryStudyStore.getState().answer('guest', 'tunduk', 'review_again');
    await new Promise((resolve) => setTimeout(resolve, 0));
    useGlossaryStudyStore.setState({ isLoaded: false, saved: {} });
    await useGlossaryStudyStore.getState().load();
    expect(ownerStudy(useGlossaryStudyStore.getState().saved, 'guest').tunduk.needsReview).toBe(true);
    useGlossaryStudyStore.getState().adoptGuest('user-a');
    const saved = useGlossaryStudyStore.getState().saved;
    expect(ownerStudy(saved, 'user-a').tunduk).toBeDefined();
    expect(ownerStudy(saved, 'guest')).toEqual({});
    expect(ownerStudy(saved, 'user-b')).toEqual({});
  });

  it('merge: counts summed, newest date, review flag from the newest action', () => {
    const account = applyAnswer({}, 'tunduk', 'review_again', at(0));
    const guest = applyAnswer(applyAnswer({}, 'tunduk', 'got_it', at(5)), 'tunduk', 'got_it', at(9));
    expect(mergeStudy(account, guest).tunduk).toEqual({ glossaryEntryId: 'tunduk', seenCount: 3, gotItCount: 2, reviewAgainCount: 1, lastReviewedAt: at(9).toISOString(), needsReview: false });
  });

  it('back of the card keeps the source verification and the Kyrgyz-fallback note', () => {
    expect(screen).toMatch(/<SourcesAndNotes contentType="culture_item" level=\{item\.accuracy_level\} sources=\{item\.sources\} \/>/);
    expect(screen).toMatch(/<KyrgyzOnlyNote status=\{item\.translation\?\.status\}/);
  });

  it('independent: no rewards, challenges, regions or Daily touched; analytics without text', () => {
    const store = fs.readFileSync(path.join(__dirname, '../../../../store/useGlossaryStudyStore.ts'), 'utf8');
    for (const code of [screen, store]) expect(code).not.toMatch(/useChallengeStore|useProgressStore|useDailyDiscoveryStore|addXp|addCoins/);
    for (const call of screen.match(/track\([^)]*\)/g) ?? []) expect(call).not.toMatch(/definition|title/);
  });

  it('Reduce Motion: instant swap, otherwise a short fade', () => {
    expect(screen).toMatch(/if \(reducedMotion\) \{\s*change\(\);\s*return;\s*\}/);
  });

  it('KG / RU / EN strings', () => {
    for (const dict of [kg, ru, en]) {
      const block = (dict as unknown as { glossaryStudy: Record<string, string> }).glossaryStudy;
      for (const key of ['title', 'showMeaning', 'reviewAgain', 'gotIt', 'termsReviewed', 'reviewTerms', 'waiting_other', 'study5', 'studyAll', 'backToGlossary', 'meaning', 'source']) expect(block[key]).toBeTruthy();
    }
  });
});
