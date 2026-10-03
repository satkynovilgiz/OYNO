import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { EMPTY_RECORDS, recordInto, type OwnerRecords } from '@/store/useGameRecordsStore';

import type { GameSessionRecord } from '../games/records/gameRecords';
import { buildTimeline, DEFAULT_DAYS, filterTimeline, groupOf, groupTimeline, personalBestRounds, timelineRoute, withinRange, type TimelineInput } from './timelineModel';

const NOW = new Date(2026, 9, 3, 15, 0); // Saturday 3 Oct 2026, 15:00 local
const local = (day: number, hour = 12, month = 9) => new Date(2026, month, day, hour).toISOString();
const EMPTY: TimelineInput = { readings: [], challengeResults: {}, glossarySessions: [], manualPathSteps: {}, gameRecords: EMPTY_RECORDS, listening: [] };
const round = (id: string, at: string, primary: number, fields: Partial<GameSessionRecord> = {}): GameSessionRecord => ({ id, gameId: 'jaa_atuu', completedAt: at, practice: false, result: 'completed', primary, secondary: {}, ...fields });
const recordsFrom = (sessions: GameSessionRecord[]): OwnerRecords => sessions.reduce((records, session) => recordInto(records, session).records, EMPTY_RECORDS);

describe('My Learning Timeline', () => {
  it('orders by timestamp, newest first, and suppresses duplicate events', () => {
    const events = buildTimeline(
      { ...EMPTY, readings: [{ contentType: 'culture_item', contentId: 'a', completedAt: local(1) }, { contentType: 'culture_item', contentId: 'b', completedAt: local(3, 9) }], glossarySessions: [local(2), local(2)], challengeResults: { 'collection:boz-uy-world': { completedAt: local(3, 10) } } },
      NOW,
    );
    expect(events.map((event) => event.kind)).toEqual(['challenge_completed', 'reading_completed', 'study_session', 'reading_completed']);
    expect(events.filter((event) => event.kind === 'study_session')).toHaveLength(1);
  });

  it('groups by LOCAL date: today, yesterday, this week (Mon-Sun), earlier', () => {
    expect(groupOf(local(3, 0), NOW)).toBe('today');
    expect(groupOf(local(2, 23), NOW)).toBe('yesterday');
    expect(groupOf(local(28, 12, 8), NOW)).toBe('this_week'); // Mon 28 Sep
    expect(groupOf(local(27, 23, 8), NOW)).toBe('earlier'); // Sun 27 Sep
    const groups = groupTimeline(buildTimeline({ ...EMPTY, glossarySessions: [local(3), local(2), local(29, 12, 8), local(1, 12, 8)] }, NOW), NOW);
    expect(groups.map((group) => group.group)).toEqual(['today', 'yesterday', 'this_week', 'earlier']);
  });

  it('filters: All / Reading / Study / Games / Audio (max 5)', () => {
    const events = buildTimeline(
      {
        ...EMPTY,
        readings: [{ contentType: 'culture_item', contentId: 'a', completedAt: local(1) }],
        glossarySessions: [local(1)],
        manualPathSteps: { 'boz-uy': { builder: local(2) } },
        gameRecords: recordsFrom([round('r1', local(2), 10)]),
        listening: [{ key: 'komuz:a', sourceType: 'komuz', sourceId: 'a', completed: true, lastListenedAt: local(2) }],
      },
      NOW,
    );
    expect(filterTimeline(events, 'reading').map((event) => event.kind)).toEqual(['reading_completed']);
    expect(filterTimeline(events, 'study').map((event) => event.kind).sort()).toEqual(['path_step', 'study_session']);
    expect(filterTimeline(events, 'games').map((event) => event.kind)).toEqual(['game_played']);
    expect(filterTimeline(events, 'audio').map((event) => event.kind)).toEqual(['listening_finished']);
  });

  it('invalid timestamps, unfinished items and practice rounds never become events', () => {
    const events = buildTimeline(
      {
        ...EMPTY,
        readings: [{ contentType: 'culture_item', contentId: 'a', completedAt: 'not-a-date' }, { contentType: 'culture_item', contentId: 'b', completedAt: null }],
        gameRecords: recordsFrom([round('p', local(2), 50, { practice: true })]),
        listening: [{ key: 'komuz:a', sourceType: 'komuz', sourceId: 'a', completed: false, lastListenedAt: local(2) }],
      },
      NOW,
    );
    expect(events).toEqual([]);
  });

  it('personal best only when the full round history is kept (never an invented date)', () => {
    const full = [round('r1', local(1, 10), 10), round('r2', local(1, 11), 20), round('r3', local(2, 10), 15)];
    expect(personalBestRounds('jaa_atuu', full, 3).map((session) => session.id)).toEqual(['r2']);
    expect(personalBestRounds('jaa_atuu', full, 25)).toEqual([]); // older rounds no longer kept
    expect(personalBestRounds('kok_boru', full, 3)).toEqual([]); // no numeric best
    const events = buildTimeline({ ...EMPTY, gameRecords: recordsFrom(full) }, NOW);
    expect(events.filter((event) => event.kind === 'personal_best')).toEqual([expect.objectContaining({ value: 20, at: local(1, 11) })]);
  });

  it('weekly goal indicator reuses the Weekly Goal completion logic (this week only)', () => {
    const events = buildTimeline({ ...EMPTY, glossarySessions: [local(3), local(1, 12, 8)] }, NOW);
    expect(events.find((event) => event.at === local(3))?.weeklyGoal).toBe(true);
    expect(events.find((event) => event.at === local(1, 12, 8))?.weeklyGoal).toBe(false);
  });

  it('default range 60 days; all history on request', () => {
    const events = buildTimeline({ ...EMPTY, glossarySessions: [local(3), new Date(2026, 5, 1).toISOString()] }, NOW);
    expect(withinRange(events, NOW, false)).toHaveLength(1);
    expect(withinRange(events, NOW, true)).toHaveLength(2);
    expect(DEFAULT_DAYS).toBe(60);
  });

  it('stale source: no route (generic card), never a crash', () => {
    const missing = () => false;
    expect(timelineRoute({ type: 'culture_item', id: 'gone' }, missing, () => null)).toBeNull();
    expect(timelineRoute({ type: 'culture_item', id: 'boz-uy-overview' }, () => true, () => null)).toBe('/culture/item/boz-uy-overview');
    expect(timelineRoute({ type: 'challenge', id: 'collection:boz-uy-world' }, () => true, () => null)).toBe('/challenges/collection-boz-uy-world');
    expect(timelineRoute({ type: 'challenge', id: 'daily:2026-10-01' }, () => true, () => null)).toBe('/challenges');
  });

  it('privacy: no Journal, notes, collection descriptions, searches or favorites; no upload', () => {
    const source = ['timelineModel.ts', 'LearningTimelineScreen.tsx'].map((file) => fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')).join('\n');
    expect(source).not.toMatch(/useJournalStore|useHighlightsStore|useMyCollectionsStore|useFavoritesStore|recentSearches|\.note\b|description|supabase/);
    const screen = fs.readFileSync(path.join(__dirname, 'LearningTimelineScreen.tsx'), 'utf8');
    for (const call of screen.match(/track\([^)]*\)/g) ?? []) expect(call).toBe("track('learning_timeline_opened')");
  });

  it('account isolation + device/cloud honesty', () => {
    const screen = fs.readFileSync(path.join(__dirname, 'LearningTimelineScreen.tsx'), 'utf8');
    expect(screen).toMatch(/const owner = useRecordsOwner\(\)/);
    expect(screen).toMatch(/ownerReading\(useReadingStore\(\(state\) => state\.saved\), owner\)/);
    expect(screen).toMatch(/scope === 'account' \? 'timeline\.scopeAccount' : 'timeline\.scopeDevice'/);
  });

  it('KG / RU / EN', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { timeline: Record<string, Record<string, string> | string> }).timeline;
      expect(block.title && block.empty).toBeTruthy();
      for (const key of ['today', 'yesterday']) expect((block.group as Record<string, string>)[key]).toBeTruthy();
      for (const key of ['reading', 'study', 'games', 'audio']) expect((block.filter as Record<string, string>)[key]).toBeTruthy();
      for (const key of ['reading_completed', 'challenge_completed', 'study_session', 'game_played', 'personal_best']) expect((block.kind as Record<string, string>)[key]).toBeTruthy();
    }
    expect(JSON.stringify((en as unknown as { timeline: unknown }).timeline)).not.toMatch(/No learning completed/);
  });
});
