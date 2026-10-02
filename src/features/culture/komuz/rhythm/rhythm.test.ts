import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import { RHYTHM_CHARTS } from './rhythmCharts';
import { GOOD_WINDOW, judgeTap, missedBeats, NEW_ROUND, PERFECT_WINDOW, roundResult, supportedCharts, upcomingBeats, validateChart, type RhythmChart } from './rhythmModel';

const TRACKS = ['ak-maral-min', 'chon-kerbez'];
const CHART: RhythmChart = { trackId: 'chon-kerbez', beats: [1, 2, 3, 4, 5, 6, 7, 8], authoredBy: 'tester', reviewed: true };

describe('Rhythm trainer - charts', () => {
  it('chart validity: known track, ascending, finite, within duration, authored', () => {
    expect(validateChart(CHART, TRACKS, 120)).toEqual([]);
    expect(validateChart({ ...CHART, beats: [1, 3, 2, 4, 5, 6, 7, 8] }, TRACKS)).toContain('beat 2 not after the previous one');
    expect(validateChart({ ...CHART, beats: [1, 2, 3, 4, 5, 6, 7, 200] }, TRACKS, 120)).toContain('beat 7 after the track ends');
    expect(validateChart({ ...CHART, trackId: 'nope' }, TRACKS)).toContain('unknown track nope');
  });

  it('unsupported / unreviewed charts are hidden; the shipped list is empty (no invented charts)', () => {
    expect(supportedCharts([{ ...CHART, reviewed: false }], TRACKS)).toEqual([]);
    expect(supportedCharts([CHART], TRACKS)).toHaveLength(1);
    expect(RHYTHM_CHARTS).toEqual([]);
    const room = fs.readFileSync(path.join(__dirname, '../listening/KomuzListeningRoomScreen.tsx'), 'utf8');
    expect(room).toMatch(/\{rhythmAvailable \? <Button label=\{t\('rhythm\.practice'\)\}/);
  });
});

describe('Rhythm trainer - timing', () => {
  it('nearest beat matching with broad windows', () => {
    expect(judgeTap(CHART.beats, NEW_ROUND, 3.05)).toMatchObject({ grade: 'perfect', beatIndex: 2 });
    expect(judgeTap(CHART.beats, NEW_ROUND, 3 + PERFECT_WINDOW + 0.05)).toMatchObject({ grade: 'good', beatIndex: 2 });
    expect(judgeTap(CHART.beats, NEW_ROUND, 3 + GOOD_WINDOW + 0.05)).toMatchObject({ grade: null, beatIndex: null });
    expect(judgeTap(CHART.beats, NEW_ROUND, 3.6).beatIndex).toBeNull();
  });

  it('a beat cannot be scored twice', () => {
    const first = judgeTap(CHART.beats, NEW_ROUND, 3.0);
    const second = judgeTap(CHART.beats, first.round, 3.02);
    expect(second.grade).toBeNull();
    expect(second.round.strayTaps).toBe(1);
    expect(roundResult(CHART.beats, second.round)).toEqual({ total: 8, hit: 1, perfect: 1, good: 0, missed: 7 });
  });

  it('missed beats and visual lane', () => {
    expect(missedBeats(CHART.beats, NEW_ROUND, 3.5)).toBe(3);
    expect(upcomingBeats(CHART.beats, 3.5)).toEqual([4, 5]);
  });

  it('background ends the round (shared player pauses; never auto-resumes); one audio session', () => {
    const screen = fs.readFileSync(path.join(__dirname, 'RhythmTrainerScreen.tsx'), 'utf8');
    expect(screen).toMatch(/if \(phase === 'playing' && wasPlaying\.current && !playing\) setPhase\('cancelled'\)/);
    expect(screen).toMatch(/useKomuzPlayerStore\.getState\(\)\.play\(chart\.trackId\)/);
    const code = screen.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/createAudioPlayer|expo-audio|microphone|Audio\.Recording/);
    expect(code).not.toMatch(/addXp|addCoins|streak|leaderboard/i);
  });

  it('KG / RU / EN strings', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { rhythm: Record<string, string> }).rhythm;
      for (const key of ['practice', 'tapWithBeat', 'ready', 'perfect', 'good', 'miss', 'beatsHit', 'tryAgain', 'chooseTrack', 'title']) expect(block[key]).toBeTruthy();
    }
  });
});
