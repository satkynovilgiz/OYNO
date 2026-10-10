/** Mini Museum narration: lifecycle, temporary-file cleanup, replacement safety, owners, playback coordination. */
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { memoryNarrationStore, setNarrationAudioStore, sweepNarrations } from '@/services/museum/narrationAudio';
import { playNarration, stopNarration, useNarrationPlayer } from '@/services/museum/narrationPlayer';
import { useMyCollectionsStore } from '@/store/useMyCollectionsStore';

import { NarrationEditor } from './Narration';
import { attachRecording, detachRecording, MAX_NARRATION_MS, normalizeNarrations, RECORDER_IDLE, recorderReducer, referencedAudio, releasedAudio, setNarrationText, type Narration } from './narrationModel';

jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/services/a11y/announce', () => ({ announce: () => undefined }));
jest.mock('@/components/ui', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    Button: (props: Record<string, unknown>) => h('Button', props, props.label),
    TextField: (props: Record<string, unknown>) => h('TextField', props),
  };
});
const mockStopOthers = jest.fn();
const mockDeleteTemp = jest.fn();
jest.mock('@/features/culture/glossary/practice/practiceAudio', () => ({ stopOtherAudio: () => mockStopOthers(), deleteRecording: (uri: string | null) => mockDeleteTemp(uri) }));
let mockSupport = 'available';
jest.mock('@/features/culture/glossary/practice/pronunciation', () => ({ recordingSupport: () => mockSupport }));
jest.mock('@/services/audioGuide/useAudioGuideStore', () => ({ useAudioGuideStore: jest.requireActual('zustand').create(() => ({ status: 'idle' })) }));
jest.mock('@/features/culture/komuz/listening/useKomuzPlayerStore', () => ({ useKomuzPlayerStore: jest.requireActual('zustand').create(() => ({ playing: false })) }));
type Store<T> = { setState: (state: Partial<T>) => void };
const mockGuide = (jest.requireMock('@/services/audioGuide/useAudioGuideStore') as { useAudioGuideStore: Store<{ status: string }> }).useAudioGuideStore;
const mockKomuz = (jest.requireMock('@/features/culture/komuz/listening/useKomuzPlayerStore') as { useKomuzPlayerStore: Store<{ playing: boolean }> }).useKomuzPlayerStore;
const mockPlayers: { uri: string; paused: boolean }[] = [];
let mockPermission = true;
const mockRecorder = { uri: null as string | null, isRecording: false, prepareToRecordAsync: async () => undefined, record: () => { mockRecorder.isRecording = true; }, stop: async () => { mockRecorder.isRecording = false; } };
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  useAudioRecorder: () => mockRecorder,
  requestRecordingPermissionsAsync: async () => ({ granted: mockPermission }),
  setAudioModeAsync: async () => undefined,
  createAudioPlayer: (uri: string) => {
    const player = { uri, paused: false, play: () => undefined, pause: () => { player.paused = true; }, remove: () => undefined, addListener: () => ({ remove: () => undefined }) };
    mockPlayers.push(player);
    return player;
  },
}));

const KEY = 'culture_item:boz-uy-tunduk';
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

describe('the narration record', () => {
  it('keeps only shown exhibits, valid ids and bounded text', () => {
    expect(normalizeNarrations({ [KEY]: { audioId: 'nabc12345-xyz', durationMs: 999_999, text: '<b>hi</b>' }, 'culture_item:gone': { audioId: 'nabc12345-zzz', durationMs: 1, text: '' }, x: 1 }, [KEY])).toEqual({ [KEY]: { audioId: 'nabc12345-xyz', durationMs: MAX_NARRATION_MS, text: 'bhi/b' } });
    expect(normalizeNarrations({ [KEY]: { audioId: '../../etc', text: '' } }, [KEY])).toEqual({});
    expect(normalizeNarrations('nope', [KEY])).toEqual({});
  });

  it('a replacement releases the previous recording only when attached; deleting keeps the written words', () => {
    const first = attachRecording(setNarrationText({}, KEY, 'words'), KEY, 'nfirst-0001', 4000);
    expect(first.released).toBeNull();
    const second = attachRecording(first.narrations, KEY, 'nsecond-0002', 5000);
    expect(second.released).toBe('nfirst-0001');
    expect(second.narrations[KEY]).toEqual({ audioId: 'nsecond-0002', durationMs: 5000, text: 'words' });
    const removed = detachRecording(second.narrations, KEY);
    expect(removed.released).toBe('nsecond-0002');
    expect(removed.narrations[KEY]).toEqual({ audioId: null, durationMs: 0, text: 'words' });
    expect(detachRecording(setNarrationText({}, KEY, ''), KEY).narrations).toEqual({});
  });

  it('knows which recordings an edit released', () => {
    const before = { narrations: { a: { audioId: 'n1-aaaaaaaa', durationMs: 1, text: '' }, b: { audioId: 'n2-bbbbbbbb', durationMs: 1, text: '' } } };
    expect(releasedAudio(before, { narrations: { a: before.narrations.a } })).toEqual(['n2-bbbbbbbb']);
    expect([...referencedAudio({ c1: before, c2: undefined })]).toEqual(['n1-aaaaaaaa', 'n2-bbbbbbbb']);
  });
});

describe('the recording lifecycle', () => {
  it('denied permission ends in a usable state; saving is only after review', () => {
    let phase = recorderReducer(RECORDER_IDLE, { type: 'ask' });
    expect(phase).toEqual({ kind: 'idle', explain: true });
    expect(recorderReducer(phase, { type: 'permission', granted: false })).toEqual({ kind: 'denied' });
    expect(recorderReducer({ kind: 'denied' }, { type: 'ask' })).toEqual({ kind: 'idle', explain: true });
    phase = recorderReducer(phase, { type: 'started', at: 1000 });
    expect(recorderReducer(phase, { type: 'save' })).toBe(phase); // nothing to save while recording
    phase = recorderReducer(phase, { type: 'stopped', tempUri: 'blob:take', at: 1000 + MAX_NARRATION_MS + 50 });
    expect(phase).toEqual({ kind: 'review', tempUri: 'blob:take', durationMs: MAX_NARRATION_MS, limitReached: true });
    phase = recorderReducer(phase, { type: 'save' });
    expect(recorderReducer(phase, { type: 'saveFailed' })).toEqual({ kind: 'failed', reason: 'save' });
    expect(recorderReducer(phase, { type: 'saved' })).toEqual(RECORDER_IDLE);
    expect(recorderReducer({ kind: 'recording', startedAt: 0 }, { type: 'stopped', tempUri: null, at: 5 })).toEqual(RECORDER_IDLE);
  });
});

describe('owner-bound storage', () => {
  it('another account cannot get the recording; reassigning moves it with the exhibitions', async () => {
    const store = memoryNarrationStore();
    const id = await store.save('guest', 'blob:take');
    expect(await store.uri('guest', id)).toBe(`memory:${id}`);
    expect(await store.uri('user-b', id)).toBeNull();
    await store.remove('user-b', id); // not theirs: untouched
    expect(store.records.has(id)).toBe(true);
    await store.reassign('guest', 'user-a');
    expect(await store.uri('guest', id)).toBeNull();
    expect(await store.uri('user-a', id)).toBe(`memory:${id}`);
  });

  it('a sweep deletes only unreferenced recordings of that owner', async () => {
    const store = memoryNarrationStore();
    setNarrationAudioStore(store);
    const kept = await store.save('user-a', 'x');
    const orphan = await store.save('user-a', 'y');
    const other = await store.save('user-b', 'z');
    expect(await sweepNarrations('user-a', new Set([kept]))).toEqual([orphan]);
    expect([...store.records.keys()].sort()).toEqual([kept, other].sort());
    setNarrationAudioStore(null);
  });
});

describe('removing exhibits and collections deletes their recordings', () => {
  let store: ReturnType<typeof memoryNarrationStore>;
  beforeEach(() => {
    store = memoryNarrationStore();
    setNarrationAudioStore(store);
    useMyCollectionsStore.setState({ isLoaded: true, saved: {}, museums: {} });
  });
  afterEach(() => setNarrationAudioStore(null));

  const setup = async (owner: string) => {
    const collection = useMyCollectionsStore.getState().create(owner, { name: 'Synthetic 4m' });
    const id = await store.save(owner, 'blob:take');
    const exhibition = { title: '', intro: '', exhibits: [KEY], captions: {}, narrations: { [KEY]: { audioId: id, durationMs: 1000, text: '' } }, updatedAt: '' };
    useMyCollectionsStore.getState().saveExhibition(owner, collection.id, exhibition);
    return { collection, id, exhibition };
  };

  it('an exhibit removed from the exhibition', async () => {
    const { collection, id, exhibition } = await setup('user-a');
    useMyCollectionsStore.getState().saveExhibition('user-a', collection.id, { ...exhibition, exhibits: [], narrations: {} });
    await flush();
    expect(store.records.has(id)).toBe(false);
  });

  it('the collection deleted, or the owner forgotten on this device', async () => {
    const { collection, id } = await setup('user-a');
    useMyCollectionsStore.getState().remove('user-a', collection.id);
    await flush();
    expect(store.records.has(id)).toBe(false);
    const second = await setup('user-b');
    useMyCollectionsStore.getState().applySynced('user-b', null);
    await flush();
    expect(store.records.has(second.id)).toBe(false);
  });

  it('a guest signing in keeps their narration, now bound to the account', async () => {
    const { id } = await setup('guest');
    useMyCollectionsStore.getState().adoptGuest('user-a');
    await flush();
    expect(await store.uri('user-a', id)).toBe(`memory:${id}`);
    expect(await store.uri('guest', id)).toBeNull();
  });
});

describe('playback coordination', () => {
  let store: ReturnType<typeof memoryNarrationStore>;
  beforeEach(() => {
    store = memoryNarrationStore();
    setNarrationAudioStore(store);
    mockPlayers.length = 0;
    mockStopOthers.mockClear();
  });
  afterEach(() => {
    stopNarration();
    setNarrationAudioStore(null);
  });

  it('stops other app audio first; the guide or komuz starting stops the narration', async () => {
    const id = await store.save('user-a', 'x');
    expect(await playNarration('user-a', id, mockStopOthers)).toBe(true);
    expect(mockStopOthers).toHaveBeenCalledTimes(1);
    expect(useNarrationPlayer.getState().playingId).toBe(id);
    act(() => mockGuide.setState({ status: 'playing' }));
    expect(useNarrationPlayer.getState().playingId).toBeNull();
    expect(mockPlayers[0].paused).toBe(true);
    mockGuide.setState({ status: 'idle' });
    await playNarration('user-a', id, mockStopOthers);
    act(() => mockKomuz.setState({ playing: true }));
    expect(useNarrationPlayer.getState().playingId).toBeNull();
    mockKomuz.setState({ playing: false });
  });

  it("another account can't play it; only one narration at a time", async () => {
    const a = await store.save('user-a', 'x');
    const b = await store.save('user-a', 'y');
    expect(await playNarration('user-b', a, mockStopOthers)).toBe(false);
    expect(mockPlayers).toHaveLength(0);
    await playNarration('user-a', a, mockStopOthers);
    await playNarration('user-a', b, mockStopOthers);
    expect(mockPlayers[0].paused).toBe(true);
    expect(useNarrationPlayer.getState().playingId).toBe(b);
  });
});

describe('the editor', () => {
  let store: ReturnType<typeof memoryNarrationStore>;
  let narrations: Record<string, Narration>;
  let screen: ReactTestRenderer;
  const byId = (testID: string) => screen.root.findAll((node) => node.props.testID === testID && typeof node.type === 'string')[0];
  const has = (testID: string) => screen.root.findAll((node) => node.props.testID === testID).length > 0;
  const press = async (testID: string) => {
    await act(async () => {
      await (byId(testID).props.onPress as () => unknown)();
    });
  };
  const render = (owner = 'user-a') => {
    const element = () => createElement(NarrationEditor, { owner, exhibitKey: KEY, title: 'Tunduk', narration: narrations[KEY] ?? null, commit: (change) => { narrations = change(narrations); } });
    act(() => {
      screen = create(element());
    });
    return () => act(() => screen.update(element()));
  };
  const recordTake = async (uri: string) => {
    await press('narration-record');
    await press('narration-allow');
    mockRecorder.uri = uri;
    await press('narration-stop');
  };

  beforeEach(() => {
    store = memoryNarrationStore();
    setNarrationAudioStore(store);
    narrations = {};
    mockSupport = 'available';
    mockPermission = true;
    mockDeleteTemp.mockClear();
  });
  afterEach(() => {
    act(() => screen.unmount());
    setNarrationAudioStore(null);
  });

  it('permission denied: no recording, written narration still works', async () => {
    mockPermission = false;
    const rerender = render();
    await press('narration-record');
    expect(has('narration-permission')).toBe(true); // explained before the OS prompt
    await press('narration-allow');
    expect(has('narration-denied')).toBe(true);
    act(() => (byId('narration-text').props.onChangeText as (value: string) => void)('My own words'));
    rerender();
    expect(narrations[KEY]).toEqual({ audioId: null, durationMs: 0, text: 'My own words' });
    expect(store.records.size).toBe(0);
  });

  it('no recording in this build: written narration only', () => {
    mockSupport = 'needs_app_update';
    render();
    expect(has('narration-unavailable')).toBe(true);
    expect(has('narration-record')).toBe(false);
    expect(has('narration-text')).toBe(true);
  });

  it('discarding (or leaving) deletes the temporary take and saves nothing', async () => {
    render();
    await recordTake('blob:take-1');
    expect(has('narration-review')).toBe(true);
    expect(narrations).toEqual({});
    await press('narration-discard');
    expect(mockDeleteTemp).toHaveBeenCalledWith('blob:take-1');
    await recordTake('blob:take-2');
    act(() => screen.unmount());
    expect(mockDeleteTemp).toHaveBeenCalledWith('blob:take-2');
    expect(store.records.size).toBe(0);
    expect(narrations).toEqual({});
    render(); // for afterEach
  });

  it('replacing: a failed save keeps the previous recording; a successful one removes it only afterwards', async () => {
    const previous = await store.save('user-a', 'old');
    narrations = { [KEY]: { audioId: previous, durationMs: 3000, text: 'transcript' } };
    render();
    expect(has('narration-saved')).toBe(true);
    // Fail the copy-in once.
    const realSave = store.save;
    store.save = async () => {
      throw new Error('disk full');
    };
    await recordTake('blob:new-1');
    await press('narration-save');
    store.save = realSave;
    expect(has('narration-failed')).toBe(true);
    expect(narrations[KEY].audioId).toBe(previous);
    expect(store.records.has(previous)).toBe(true);
    expect(mockDeleteTemp).toHaveBeenCalledWith('blob:new-1');
    // Now it works.
    await press('narration-retry');
    await press('narration-allow');
    mockRecorder.uri = 'blob:new-2';
    await press('narration-stop');
    await press('narration-save');
    const replacement = narrations[KEY].audioId as string;
    expect(replacement).not.toBe(previous);
    expect(narrations[KEY].text).toBe('transcript');
    expect(store.records.has(replacement)).toBe(true);
    expect(store.records.has(previous)).toBe(false);
    expect(mockDeleteTemp).toHaveBeenCalledWith('blob:new-2');
  });

  it('deleting asks first, removes the file and keeps the words', async () => {
    const saved = await store.save('user-a', 'old');
    narrations = { [KEY]: { audioId: saved, durationMs: 3000, text: 'words' } };
    render();
    await press('narration-delete');
    expect(store.records.has(saved)).toBe(true);
    await press('narration-delete-confirm');
    await flush();
    expect(store.records.has(saved)).toBe(false);
    expect(narrations[KEY]).toEqual({ audioId: null, durationMs: 0, text: 'words' });
  });
});
