import * as fs from 'fs';
import * as path from 'path';

import AsyncStorage from '@react-native-async-storage/async-storage';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { ownerReading, useReadingStore } from '@/store/useReadingStore';

import {
  COMPLETION_THRESHOLD,
  continueReading,
  markRead,
  mergeReading,
  MIN_MEANINGFUL_PROGRESS,
  percentRead,
  recentlyRead,
  recordPosition,
  resetReading,
  resumeOffset,
  scrollRatio,
  shouldOfferResume,
  type ReadingData,
} from './readingModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 2, 10, minutes));
const all = () => true;
const source = (file: string) => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('Reading progress - measurement and rules', () => {
  it('progress is the real scroll ratio; non-scrollable content measures nothing', () => {
    expect(scrollRatio(500, 2000, 1000)).toBe(0.5);
    expect(scrollRatio(1200, 2000, 1000)).toBe(1);
    expect(scrollRatio(300, 900, 1000)).toBeNull();
    expect(source('useReadingTracker.ts')).not.toMatch(/setInterval|setTimeout/);
  });

  it('an accidental short open is ignored', () => {
    expect(MIN_MEANINGFUL_PROGRESS).toBe(0.05);
    expect(recordPosition({}, 'culture_item', 'boz-uy-overview', 0.03, at(0))).toEqual({});
  });

  it('normalized progress is saved (ratio, not pixels), furthest point kept', () => {
    let data = recordPosition({}, 'culture_item', 'boz-uy-overview', 0.62, at(0));
    data = recordPosition(data, 'culture_item', 'boz-uy-overview', 0.3, at(1));
    expect(data['culture_item:boz-uy-overview']).toEqual({ contentType: 'culture_item', contentId: 'boz-uy-overview', progress: 0.3, furthest: 0.62, lastReadAt: at(1).toISOString(), completedAt: null });
    expect(percentRead(data['culture_item:boz-uy-overview'])).toBe(62);
  });

  it('reaching the completion threshold marks completed; completed stays completed', () => {
    expect(COMPLETION_THRESHOLD).toBe(0.9);
    let data = recordPosition({}, 'culture_material', 'felt', 0.91, at(0));
    expect(data['culture_material:felt'].completedAt).toBe(at(0).toISOString());
    data = recordPosition(data, 'culture_material', 'felt', 0.2, at(5));
    expect(data['culture_material:felt'].completedAt).toBe(at(0).toISOString());
  });

  it('Continue reading = most recent unfinished; completed excluded; recently read newest first', () => {
    let data: ReadingData = {};
    data = recordPosition(data, 'culture_item', 'a', 0.4, at(0));
    data = recordPosition(data, 'culture_item', 'b', 0.95, at(1));
    data = recordPosition(data, 'culture_material', 'c', 0.2, at(2));
    expect(continueReading(data, all)?.contentId).toBe('c');
    expect(continueReading(markRead(data, 'culture_material', 'c', at(3)), all)?.contentId).toBe('a');
    expect(recentlyRead(data, all).map((record) => record.contentId)).toEqual(['c', 'b', 'a']);
  });

  it('resume is offered only for unfinished reading; a completed article opens at the top', () => {
    const data = recordPosition(recordPosition({}, 'culture_item', 'a', 0.4, at(0)), 'culture_item', 'b', 0.95, at(1));
    expect(shouldOfferResume(data['culture_item:a'])).toBe(true);
    expect(shouldOfferResume(data['culture_item:b'])).toBe(false);
    expect(shouldOfferResume(undefined)).toBe(false);
  });

  it('resume maps the saved ratio onto the CURRENT layout (language/layout change safe)', () => {
    expect(resumeOffset(0.5, 3000, 1000)).toBe(1000);
    // Same 50% in a longer translation lands proportionally further down.
    expect(resumeOffset(0.5, 4200, 1000)).toBe(1600);
    expect(resumeOffset(0.5, 800, 1000)).toBeNull();
    const tracker = source('useReadingTracker.ts');
    expect(tracker).toMatch(/pendingResume\.current = record\.progress/);
    expect(tracker).not.toMatch(/scrollTo\(\{ y: record/);
  });

  it('start over clears only that article; stale content is skipped', () => {
    const data = recordPosition(recordPosition({}, 'culture_item', 'a', 0.4, at(0)), 'culture_item', 'gone', 0.5, at(1));
    expect(Object.keys(resetReading(data, 'culture_item', 'a'))).toEqual(['culture_item:gone']);
    const exists = (record: { contentId: string }) => record.contentId !== 'gone';
    expect(recentlyRead(data, exists).map((record) => record.contentId)).toEqual(['a']);
    expect(continueReading(data, exists)?.contentId).toBe('a');
  });

  it('guest -> account merge: furthest progress, newest lastReadAt, completed wins, no duplicates', () => {
    const account = recordPosition({}, 'culture_item', 'a', 0.7, at(0));
    const guest = markRead(recordPosition({}, 'culture_item', 'a', 0.3, at(9)), 'culture_item', 'a', at(9));
    const merged = mergeReading(account, guest);
    expect(Object.keys(merged)).toEqual(['culture_item:a']);
    expect(merged['culture_item:a']).toMatchObject({ furthest: 0.9, lastReadAt: at(9).toISOString(), completedAt: at(9).toISOString() });
  });
});

describe('Reading progress - storage, accounts, privacy', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useReadingStore.setState({ isLoaded: false, saved: {} });
  });

  it('guest progress persists on the device (local write - works offline)', async () => {
    jest.useFakeTimers();
    await useReadingStore.getState().load();
    useReadingStore.getState().record('guest', 'culture_item', 'boz-uy-overview', 0.5);
    jest.advanceTimersByTime(500);
    jest.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 0));
    useReadingStore.setState({ isLoaded: false, saved: {} });
    await useReadingStore.getState().load();
    expect(ownerReading(useReadingStore.getState().saved, 'guest')['culture_item:boz-uy-overview'].progress).toBe(0.5);
    expect(fs.readFileSync(path.join(__dirname, '../../../store/useReadingStore.ts'), 'utf8')).not.toMatch(/supabase|fetch\(/);
  });

  it('guest adopted on sign-in; A -> B: B never sees A', async () => {
    await useReadingStore.getState().load();
    useReadingStore.getState().record('guest', 'culture_item', 'a', 0.5);
    useReadingStore.getState().adoptGuest('user-a');
    const saved = useReadingStore.getState().saved;
    expect(Object.keys(ownerReading(saved, 'user-a'))).toEqual(['culture_item:a']);
    expect(ownerReading(saved, 'guest')).toEqual({});
    expect(ownerReading(saved, 'user-b')).toEqual({});
    expect(fs.readFileSync(path.join(__dirname, '../../../services/sync/accountLifecycle.ts'), 'utf8')).toMatch(/useReadingStore\.getState\(\)\.adoptGuest\(userId\)/);
  });

  it('analytics: event + content type/id only - never title, text or progress', () => {
    const tracker = source('useReadingTracker.ts');
    for (const call of tracker.match(/track\([^)]*\)/g) ?? []) {
      expect(call).toMatch(/content_type: contentType, content_id: contentId/);
      expect(call).not.toMatch(/progress|ratio|title|percent/);
    }
  });

  it('KG / RU / EN strings', () => {
    for (const dict of [kg, ru, en]) {
      const reading = (dict as unknown as { reading: Record<string, string> }).reading;
      for (const key of ['continueReading', 'recentlyRead', 'resumeQuestion', 'continue', 'fromBeginning', 'progress', 'completed', 'markRead', 'startOver', 'percentRead', 'onThisDevice']) expect(reading[key]).toBeTruthy();
    }
  });
});
