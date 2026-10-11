/** Listening Notebook: captured positions, seek bounds, missing tracks, failed saves, and playback left alone while editing. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { LISTENING_NOTEBOOK_KEY, ownerNotebook, useListeningNotebookStore } from '@/store/useListeningNotebookStore';

import { ListeningNotebook } from './ListeningNotebook';
import { captureMoment, groupedMoments, normalizeNotebook, seekPlan, setMomentNote, type Moment } from './notebookModel';

jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/a11y/announce', () => ({ announce: () => undefined }));
jest.mock('@/features/games/records/useGameRecords', () => {
  const owner = jest.requireActual('zustand').create(() => ({ owner: 'user-a' }));
  return { mockOwner: owner, useRecordsOwner: () => owner((state: { owner: string }) => state.owner) };
});
const mockOwner = (jest.requireMock('@/features/games/records/useGameRecords') as { mockOwner: { setState: (state: { owner: string }) => void } }).mockOwner;
// The EXISTING player, as a stand-in exposing the same surface (calls recorded).
jest.mock('./useKomuzPlayerStore', () => {
  const calls: string[] = [];
  const store = jest.requireActual('zustand').create(() => ({
    currentTrackId: 'ak-maral-min',
    position: 42.37,
    duration: 120,
    playing: true,
    seek: (seconds: number) => calls.push(`seek:${seconds}`),
    playFrom: (id: string, seconds: number) => calls.push(`playFrom:${id}:${seconds}`),
    play: () => calls.push('play'),
    toggle: () => calls.push('toggle'),
    pause: () => calls.push('pause'),
    stop: () => calls.push('stop'),
  }));
  return { useKomuzPlayerStore: store, mockCalls: calls };
});
const player = jest.requireMock('./useKomuzPlayerStore') as { useKomuzPlayerStore: { setState: (state: Record<string, unknown>) => void }; mockCalls: string[] };
jest.mock('@/components/ui', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    AnimatedPressable: (props: Record<string, unknown>) => h('AnimatedPressable', props, props.children),
    Button: (props: Record<string, unknown>) => h('Button', props, props.label),
    TextField: (props: Record<string, unknown>) => h('TextField', props),
  };
});

const moment = (patch: Partial<Moment> = {}): Moment => ({ id: 'm1abc', trackId: 'ak-maral-min', seconds: 42.4, titleSnapshot: 'Ак марал мин', note: '', createdAt: '', updatedAt: '', ...patch });

describe('capturing and seeking', () => {
  it('captures the position the player reports, clamped to the duration', () => {
    expect(captureMoment({}, { trackId: 'ak-maral-min', title: 'T', position: 42.37, duration: 120 }).moment?.seconds).toBe(42.4);
    expect(captureMoment({}, { trackId: 'ak-maral-min', title: 'T', position: 999, duration: 120 }).moment?.seconds).toBe(120);
    expect(captureMoment({}, { trackId: 'ak-maral-min', title: 'T', position: -3, duration: null }).moment?.seconds).toBe(0);
    expect(captureMoment({}, { trackId: '../x', title: 'T', position: 1, duration: 10 }).moment).toBeNull();
  });

  it('seeking: same track -> clamped seek; other track -> start there; no duration -> explained; missing -> kept', () => {
    expect(seekPlan(moment({ seconds: 150 }), { currentTrackId: 'ak-maral-min', duration: 120 }, true)).toEqual({ kind: 'seek', seconds: 120 });
    expect(seekPlan(moment({ seconds: 30 }), { currentTrackId: 'other', duration: 120 }, true)).toEqual({ kind: 'playFrom', seconds: 30 });
    expect(seekPlan(moment(), { currentTrackId: 'ak-maral-min', duration: null }, true)).toEqual({ kind: 'notSeekable' });
    expect(seekPlan(moment(), { currentTrackId: null, duration: null }, false)).toEqual({ kind: 'missing' });
  });

  it('moments are ordered by timestamp per track; unknown tracks are kept, listed last', () => {
    const notebook = { ma: moment({ id: 'ma', seconds: 90 }), mb: moment({ id: 'mb', seconds: 10 }), mc: moment({ id: 'mc', trackId: 'gone-track', seconds: 5 }) };
    expect(groupedMoments(notebook, ['ak-maral-min']).map((group) => [group.trackId, group.moments.map((entry) => entry.seconds)])).toEqual([['ak-maral-min', [10, 90]], ['gone-track', [5]]]);
    expect(setMomentNote(notebook, 'ma', '<b>soft</b> start').ma.note).toBe('bsoft/b start');
    expect(normalizeNotebook({ x: { id: 'bad', trackId: 'a', seconds: 1 } })).toEqual({});
  });
});

describe('the store', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useListeningNotebookStore.setState({ status: 'ready', saved: {} });
  });
  it('per owner, survives a restart; failed writes change nothing; unreadable data blocks writes', async () => {
    const saved = await useListeningNotebookStore.getState().capture('user-a', { trackId: 'ak-maral-min', title: 'T', position: 5, duration: 60 });
    expect(saved).not.toBeNull();
    expect(ownerNotebook(useListeningNotebookStore.getState().saved, 'user-b')).toEqual({});
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk full'));
    try {
      expect(await useListeningNotebookStore.getState().setNote('user-a', saved!.id, 'lost?')).toBe(false);
    } finally {
      AsyncStorage.setItem = real;
    }
    expect(ownerNotebook(useListeningNotebookStore.getState().saved, 'user-a')[saved!.id].note).toBe('');
    useListeningNotebookStore.setState({ status: 'idle', saved: {} });
    await useListeningNotebookStore.getState().load();
    expect(Object.keys(ownerNotebook(useListeningNotebookStore.getState().saved, 'user-a'))).toEqual([saved!.id]);
    await AsyncStorage.setItem(LISTENING_NOTEBOOK_KEY, 'not json');
    useListeningNotebookStore.setState({ status: 'idle', saved: {} });
    await useListeningNotebookStore.getState().load();
    expect(useListeningNotebookStore.getState().status).toBe('error');
    expect(await useListeningNotebookStore.getState().capture('user-a', { trackId: 'ak-maral-min', title: 'T', position: 5, duration: 60 })).toBeNull();
  });
});

describe('the notebook in the Listening Room', () => {
  let screen: ReactTestRenderer;
  const all = (testID: string) => screen.root.findAll((node: ReactTestInstance) => node.props.testID === testID && typeof node.type === 'string');
  const byPrefix = (prefix: string) => screen.root.findAll((node: ReactTestInstance) => typeof node.props.testID === 'string' && node.props.testID.startsWith(prefix) && typeof node.type === 'string');
  const press = (testID: string) => act(async () => { await all(testID)[0].props.onPress(); });
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockOwner.setState({ owner: 'user-a' });
    player.mockCalls.length = 0;
    player.useKomuzPlayerStore.setState({ currentTrackId: 'ak-maral-min', position: 42.37, duration: 120 });
    useListeningNotebookStore.setState({ status: 'ready', saved: {} });
    act(() => {
      screen = create(createElement(ListeningNotebook));
    });
  });
  afterEach(() => act(() => screen.unmount()));

  it('save moment -> failed note -> retry; editing never touches playback; tapping seeks the same player', async () => {
    await press('notebook-save-moment');
    const [id] = Object.keys(ownerNotebook(useListeningNotebookStore.getState().saved, 'user-a'));
    expect(ownerNotebook(useListeningNotebookStore.getState().saved, 'user-a')[id].seconds).toBe(42.4);
    act(() => all(`notebook-note-${id}`)[0].props.onChangeText('The rhythm slows here'));
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk full'));
    await press(`notebook-save-note-${id}`);
    AsyncStorage.setItem = real;
    expect(all(`notebook-note-${id}`)[0].props.value).toBe('The rhythm slows here'); // kept for retry
    await press(`notebook-save-note-${id}`);
    expect(ownerNotebook(useListeningNotebookStore.getState().saved, 'user-a')[id].note).toBe('The rhythm slows here');
    expect(player.mockCalls).toEqual([]); // saving and editing never played, paused or seeked
    await press(`notebook-go-${id}`);
    expect(player.mockCalls).toEqual(['seek:42.4']);
  });

  it('a failed capture keeps the captured time for Retry (not the time of the retry)', async () => {
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk full'));
    await press('notebook-save-moment');
    AsyncStorage.setItem = real;
    expect(all('notebook-capture-failed')).toHaveLength(1);
    player.useKomuzPlayerStore.setState({ position: 80 });
    await press('notebook-capture-retry');
    expect(Object.values(ownerNotebook(useListeningNotebookStore.getState().saved, 'user-a'))[0].seconds).toBe(42.4);
  });

  it('the account changes while a capture is being written: saved for the first account, nothing shown for the new one', async () => {
    const real = AsyncStorage.setItem;
    let release: () => void = () => undefined;
    AsyncStorage.setItem = (key: string, value: string) => new Promise<void>((resolve) => (release = () => void real(key, value).then(resolve)));
    let saving: Promise<void> = Promise.resolve();
    act(() => {
      saving = all('notebook-save-moment')[0].props.onPress();
    });
    act(() => mockOwner.setState({ owner: 'user-b' }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      release();
      await saving;
    });
    AsyncStorage.setItem = real;
    expect(Object.values(ownerNotebook(useListeningNotebookStore.getState().saved, 'user-a'))).toHaveLength(1);
    expect(ownerNotebook(useListeningNotebookStore.getState().saved, 'user-b')).toEqual({});
    expect(byPrefix('notebook-moment-')).toHaveLength(0); // user-b sees no moment and no open editor
    expect(byPrefix('notebook-note-m')).toHaveLength(0);
  });

  it('an unavailable recording keeps its notes; another account sees none', async () => {
    act(() => useListeningNotebookStore.setState({ status: 'ready', saved: { 'user-a': { mgone1: moment({ id: 'mgone1', trackId: 'removed-track', note: 'Kept note' }) } } }));
    expect(all('notebook-track-missing')).toHaveLength(1);
    expect(all('notebook-note-text-mgone1')[0].children).toContain('Kept note');
    act(() => mockOwner.setState({ owner: 'user-b' }));
    expect(byPrefix('notebook-moment-')).toHaveLength(0);
  });
});
