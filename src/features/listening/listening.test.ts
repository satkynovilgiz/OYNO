import * as fs from 'fs';
import * as path from 'path';

import AsyncStorage from '@react-native-async-storage/async-storage';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { ownerListening, useListeningStore } from '@/store/useListeningStore';

import { addBookmark, continueListening, EMPTY_LISTENING, HISTORY_LIMIT, mergeListening, parseResumeParam, recentListening, recordListening, removeBookmark, resumeRoute, sortedBookmarks } from './listeningModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 2, 10, minutes)).toISOString();
const guide = { sourceType: 'guide' as const, sourceId: 'culture_item:boz-uy-tunduk', title: 'Түндүк', route: '/culture/item/boz-uy-tunduk' };
const komuz = { sourceType: 'komuz' as const, sourceId: 'chon-kerbez', title: 'Чоң кербез', route: '/culture/komuz/listen' };
const all = () => true;

describe('Listening history', () => {
  it('recorded audio keeps a real position in seconds; device speech only a section', () => {
    let data = recordListening(EMPTY_LISTENING, { ...komuz, positionType: 'seconds', position: 134.6, completed: false, at: at(0) });
    data = recordListening(data, { ...guide, positionType: 'chunk', position: 3, completed: false, at: at(1) });
    expect(data.history['komuz:chon-kerbez']).toMatchObject({ positionType: 'seconds', position: 134.6 });
    expect(data.history['guide:culture_item:boz-uy-tunduk']).toMatchObject({ positionType: 'chunk', position: 3 });
  });

  it('newest first, capped', () => {
    let data = EMPTY_LISTENING;
    for (let i = 0; i < HISTORY_LIMIT + 4; i++) data = recordListening(data, { ...komuz, sourceId: `t${i}`, positionType: 'seconds', position: 1, completed: false, at: at(i) });
    const list = recentListening(data);
    expect(list).toHaveLength(HISTORY_LIMIT);
    expect(list[0].sourceId).toBe(`t${HISTORY_LIMIT + 3}`);
  });

  it('Continue listening = latest unfinished with a real position; finished only from a real end', () => {
    let data = recordListening(EMPTY_LISTENING, { ...komuz, positionType: 'seconds', position: 60, completed: false, at: at(0) });
    data = recordListening(data, { ...guide, positionType: null, position: null, completed: true, at: at(1) });
    expect(continueListening(data, all)?.sourceId).toBe('chon-kerbez');
    expect(continueListening(data, (record) => record.sourceId !== 'chon-kerbez')).toBeNull();
    const tracker = fs.readFileSync(path.join(__dirname, 'listeningTracker.ts'), 'utf8');
    expect(tracker).toMatch(/completed: state\.status === 'finished'/);
    expect(tracker).toMatch(/completed: !!finished/);
  });
});

describe('Audio bookmarks', () => {
  it('seconds for recordings, section for TTS; no duplicates; removable', () => {
    const first = addBookmark(EMPTY_LISTENING, { ...komuz, positionType: 'seconds', position: 134.9 });
    expect(first.bookmark).toMatchObject({ positionType: 'seconds', position: 134 });
    expect(addBookmark(first.data, { ...komuz, positionType: 'seconds', position: 134.2 }).data).toBe(first.data);
    const tts = addBookmark(first.data, { ...guide, positionType: 'chunk', position: 2 });
    expect(sortedBookmarks(tts.data)).toHaveLength(2);
    expect(removeBookmark(tts.data, first.bookmark.id).bookmarks[first.bookmark.id]).toBeUndefined();
  });

  it('resume opens the content with the saved point; never autoplays', () => {
    expect(resumeRoute({ ...komuz, positionType: 'seconds', position: 134 })).toBe('/culture/komuz/listen?resumeTrack=chon-kerbez&at=134');
    const guideRoute = resumeRoute({ ...guide, positionType: 'chunk', position: 2 });
    expect(guideRoute).toMatch(/^\/culture\/item\/boz-uy-tunduk\?resumeAudio=/);
    expect(parseResumeParam(guideRoute.split('resumeAudio=')[1])).toEqual({ contentKey: 'culture_item:boz-uy-tunduk', type: 'chunk', value: 2 });
    expect(parseResumeParam('x|weird|5')).toBeNull();
    expect(parseResumeParam('x|seconds|NaN')).toBeNull();
    const player = fs.readFileSync(path.join(__dirname, '../../components/audio/AudioGuidePlayer.tsx'), 'utf8');
    expect(player).toMatch(/onPress=\{\(\) => store\.start\(sessionKey, plan, \{ title, route \}, \{ type: resume\.type, value: resume\.value \}\)\}/);
    expect(player).not.toMatch(/useEffect\([^)]*store\.start/);
  });
});

describe('Listening - accounts, privacy, exclusion', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useListeningStore.setState({ isLoaded: false, saved: {} });
  });

  it('guest -> account merge; A -> B isolation', async () => {
    await useListeningStore.getState().load();
    useListeningStore.getState().record('guest', { ...komuz, positionType: 'seconds', position: 10, completed: false, at: at(0) });
    useListeningStore.getState().addBookmark('guest', { ...guide, positionType: 'chunk', position: 1 });
    useListeningStore.getState().adoptGuest('user-a');
    const saved = useListeningStore.getState().saved;
    expect(Object.keys(ownerListening(saved, 'user-a').history)).toEqual(['komuz:chon-kerbez']);
    expect(Object.keys(ownerListening(saved, 'user-a').bookmarks)).toHaveLength(1);
    expect(ownerListening(saved, 'user-b')).toEqual(EMPTY_LISTENING);
    expect(mergeListening(EMPTY_LISTENING, ownerListening(saved, 'user-a')).history['komuz:chon-kerbez'].position).toBe(10);
  });

  it('no positions in analytics; the one-player rule is untouched', () => {
    for (const file of ['listeningModel.ts', 'listeningTracker.ts', 'ListeningScreen.tsx']) expect(fs.readFileSync(path.join(__dirname, file), 'utf8')).not.toMatch(/track\(/);
    const komuzStore = fs.readFileSync(path.join(__dirname, '../culture/komuz/listening/useKomuzPlayerStore.ts'), 'utf8');
    expect(komuzStore).toMatch(/useAudioGuideStore\.getState\(\)\.stop\(\);/);
  });

  it('KG / RU / EN strings', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { listening: Record<string, string> }).listening;
      for (const key of ['continue', 'title', 'bookmarks', 'savePoint', 'saveSection', 'saved', 'resume', 'unavailable', 'recent']) expect(block[key]).toBeTruthy();
    }
  });
});
