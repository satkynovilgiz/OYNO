/** Culture Time Capsule: the local-calendar rule, lifecycle, snapshot independence, owner-bound storage, failed writes. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { localDateKey } from '@/services/daily/dailyDiscovery';
import type { MotifLayer } from '@/services/culture/oymoEditor';
import { CAPSULES_KEY, ownerCapsules, useCapsuleStore } from '@/store/useCapsuleStore';

import { addArticle, clampOpenOn, daysUntil, earliestOpenOn, editDraft, isDue, latestOpenOn, newCapsule, normalizeCapsule, offerDesign, openCapsule, reflect, seal, sealProblems, snapshotDesign, stepDate, takeOfferedDesign, type Capsule } from './capsuleModel';
import { CapsuleListScreen, CapsuleScreen } from './CapsuleScreens';

jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/services/a11y/announce', () => ({ announce: () => undefined }));
jest.mock('@/store/useFeedbackStore', () => ({ useFeedbackStore: () => undefined }));
jest.mock('@/features/games/records/useGameRecords', () => {
  const owner = jest.requireActual('zustand').create(() => ({ owner: 'user-a' }));
  return { mockOwner: owner, useRecordsOwner: () => owner((state: { owner: string }) => state.owner) };
});
const mockOwner = (jest.requireMock('@/features/games/records/useGameRecords') as { mockOwner: { setState: (state: { owner: string }) => void } }).mockOwner;
jest.mock('@/features/culture/connections/useConnectionContent', () => ({
  useConnectionContent: () => ({ get: (type: string, id: string) => (id === 'boz-uy-tunduk' ? { type, id, title: 'Tunduk', image: null } : null), all: () => [], exists: () => false, isLoading: false, waitingForNetwork: false, retry: () => undefined }),
}));
jest.mock('@/components/ui', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    AnimatedPressable: (props: Record<string, unknown>) => h('AnimatedPressable', props, props.children),
    Button: (props: Record<string, unknown>) => h('Button', props, props.label),
    IconButton: (props: Record<string, unknown>) => h('IconButton', props),
    TextField: (props: Record<string, unknown>) => h('TextField', props),
    TextButton: (props: Record<string, unknown>) => h('TextButton', props),
  };
});

const layer = (x: number): MotifLayer => ({ id: `layer${x}`, motifId: 'gul', color: '#2F5233', point: { x, y: 100 }, rotation: 0, scale: 1, visible: true });
const ready = (patch: Partial<Capsule> = {}) => editDraft({ ...newCapsule(new Date('2026-10-10T09:00:00')), ...patch }, { title: 'For 2027', message: 'Remember the felt workshop.', openOn: '2026-10-11' });

describe('the local-calendar opening rule', () => {
  afterEach(() => jest.useRealTimers());

  it('opens on the opening date itself, not the day before', () => {
    const sealed = seal(ready(), '2026-10-10');
    expect(sealed.status).toBe('sealed');
    expect(isDue(sealed, '2026-10-10')).toBe(false);
    expect(isDue(sealed, '2026-10-11')).toBe(true);
    expect(isDue(sealed, '2027-01-01')).toBe(true);
    expect(daysUntil('2026-10-11', '2026-10-10')).toBe(1);
    expect(daysUntil('2026-10-11', '2026-10-12')).toBe(0);
  });

  it('turns over at LOCAL midnight (the device clock), via localDateKey', () => {
    const sealed = seal(ready(), '2026-10-10');
    jest.useFakeTimers({ now: new Date(2026, 9, 10, 23, 59, 59) });
    expect(isDue(sealed, localDateKey())).toBe(false);
    jest.setSystemTime(new Date(2026, 9, 11, 0, 0, 0));
    expect(isDue(sealed, localDateKey())).toBe(true);
  });

  it('date steps keep real calendar dates (month ends, leap years); limits are tomorrow .. +50 years', () => {
    expect(stepDate('2026-01-31', 'month', 1)).toBe('2026-02-28');
    expect(stepDate('2028-01-31', 'month', 1)).toBe('2028-02-29');
    expect(stepDate('2028-02-29', 'year', 1)).toBe('2029-02-28');
    expect(stepDate('2026-12-31', 'day', 1)).toBe('2027-01-01');
    expect(earliestOpenOn('2026-12-31')).toBe('2027-01-01');
    expect(clampOpenOn('2026-10-10', '2026-10-10')).toBe('2026-10-11');
    expect(clampOpenOn('2099-01-01', '2026-10-10')).toBe(latestOpenOn('2026-10-10'));
    expect(sealProblems(editDraft(ready(), { openOn: '2026-10-10' }), '2026-10-10')).toEqual(['dateTooSoon']);
    expect(sealProblems(editDraft(ready(), { openOn: '2026-02-30' }), '2026-01-01')).toEqual(['noDate']); // not a real date
  });
});

describe('lifecycle', () => {
  it('a draft needs a title, a message and a date; sealed capsules are not editable', () => {
    expect(sealProblems(newCapsule(), '2026-10-10')).toEqual(['noTitle', 'noMessage', 'noDate']);
    const sealed = seal(ready(), '2026-10-10');
    expect(editDraft(sealed, { message: 'changed' })).toBe(sealed);
    expect(seal(sealed, '2026-10-10')).toBe(sealed);
  });

  it('opening early needs the explicit flag and is recorded; on the date it opens normally', () => {
    const sealed = seal(ready(), '2026-10-10');
    expect(openCapsule(sealed, '2026-10-10')).toBe(sealed);
    expect(openCapsule(sealed, '2026-10-10', { early: true })).toMatchObject({ status: 'opened', openedEarly: true });
    expect(openCapsule(sealed, '2026-10-11')).toMatchObject({ status: 'opened', openedEarly: false });
  });

  it('a reflection never changes the original message', () => {
    const opened = openCapsule(seal(ready(), '2026-10-10'), '2026-10-11');
    const reflected = reflect(opened, 'I went back to the workshop.');
    expect(reflected.message).toBe('Remember the felt workshop.');
    expect(reflected.reflection).toBe('I went back to the workshop.');
    expect(reflect(seal(ready(), '2026-10-10'), 'x').reflection).toBe(''); // not before opening
  });

  it('at most three articles, no duplicates', () => {
    let capsule = ready();
    for (const id of ['a', 'b', 'a', 'c', 'd']) capsule = addArticle(capsule, { type: 'culture_item', id, titleSnapshot: id });
    expect(capsule.articles.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });

  it('the Oymo snapshot is independent of the design it was taken from', () => {
    const design = { layers: [layer(60), layer(120)], backgroundColor: '#EADCC0', symmetry: 'mirror' as const };
    offerDesign('user-a', snapshotDesign(design));
    design.layers[0].point.x = 5;
    design.layers.push(layer(200));
    expect(takeOfferedDesign('user-b')).toBeNull(); // another owner gets nothing (and the offer is gone)
    offerDesign('user-a', snapshotDesign({ ...design, layers: design.layers.slice(0, 2) }));
    const taken = takeOfferedDesign('user-a')!;
    design.layers[1].color = '#000000';
    expect(taken.layers.map((entry) => [entry.point.x, entry.color])).toEqual([[5, '#2F5233'], [120, '#2F5233']]);
    expect(takeOfferedDesign('user-a')).toBeNull(); // taken once
  });

  it('tampered storage is bounded', () => {
    expect(normalizeCapsule({ id: '../x' })).toBeNull();
    expect(normalizeCapsule({ id: 'tc1', status: 'magic', openOn: 'soon', articles: [{ type: 'region', id: 'x' }], design: { layers: 'no' } })).toMatchObject({ status: 'draft', openOn: null, articles: [], design: null });
  });
});

describe('the store: owners and explicit writes', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useCapsuleStore.setState({ status: 'ready', saved: {} });
  });

  it('per owner; survives a restart', async () => {
    expect(await useCapsuleStore.getState().save('user-a', ready())).toBe(true);
    expect(ownerCapsules(useCapsuleStore.getState().saved, 'user-b')).toEqual([]);
    useCapsuleStore.setState({ status: 'idle', saved: {} });
    await useCapsuleStore.getState().load();
    expect(ownerCapsules(useCapsuleStore.getState().saved, 'user-a')).toHaveLength(1);
  });

  it('a failed write changes nothing and reports false', async () => {
    const first = ready();
    await useCapsuleStore.getState().save('user-a', first);
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk full'));
    try {
      expect(await useCapsuleStore.getState().save('user-a', editDraft(first, { message: 'new words' }))).toBe(false);
      expect(await useCapsuleStore.getState().remove('user-a', first.id)).toBe(false);
    } finally {
      AsyncStorage.setItem = real;
    }
    expect(ownerCapsules(useCapsuleStore.getState().saved, 'user-a')[0].message).toBe('Remember the felt workshop.');
  });

  it('unreadable data is an error, never "no capsules", and is not saved over', async () => {
    await AsyncStorage.setItem(CAPSULES_KEY, '{not json');
    useCapsuleStore.setState({ status: 'idle', saved: {} });
    await useCapsuleStore.getState().load();
    expect(useCapsuleStore.getState().status).toBe('error');
    expect(await useCapsuleStore.getState().save('user-a', ready())).toBe(false);
    expect(await AsyncStorage.getItem(CAPSULES_KEY)).toBe('{not json');
  });
});

describe('the screens', () => {
  let screen: ReactTestRenderer;
  const all = (testID: string) => screen.root.findAll((node: ReactTestInstance) => node.props.testID === testID && typeof node.type === 'string');
  const has = (testID: string) => all(testID).length > 0;
  const press = (testID: string) => act(async () => { await all(testID)[0].props.onPress(); });
  const type = (testID: string, value: string) => act(() => all(testID)[0].props.onChangeText(value));

  beforeEach(async () => {
    await AsyncStorage.clear();
    mockOwner.setState({ owner: 'user-a' });
    useCapsuleStore.setState({ status: 'ready', saved: {} });
  });
  afterEach(() => act(() => screen.unmount()));

  it('a failed save keeps the draft on screen and Retry saves it', async () => {
    act(() => {
      screen = create(createElement(CapsuleScreen, { capsuleId: 'new', onPressBack: () => undefined }));
    });
    type('capsule-title', 'For later');
    type('capsule-message', 'Hello, future me.');
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk full'));
    await press('capsule-save-draft');
    AsyncStorage.setItem = real;
    expect(has('capsule-save-failed')).toBe(true);
    expect(all('capsule-message')[0].props.value).toBe('Hello, future me.');
    expect(ownerCapsules(useCapsuleStore.getState().saved, 'user-a')).toEqual([]);
    await press('capsule-retry');
    expect(has('capsule-save-failed')).toBe(false);
    expect(ownerCapsules(useCapsuleStore.getState().saved, 'user-a')[0]).toMatchObject({ title: 'For later', message: 'Hello, future me.', status: 'draft' });
  });

  it('failed save -> edit -> Retry saves the LATEST text -> reopen shows it', async () => {
    act(() => {
      screen = create(createElement(CapsuleScreen, { capsuleId: 'new', onPressBack: () => undefined }));
    });
    type('capsule-title', 'For later');
    type('capsule-message', 'First words.');
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk full'));
    await press('capsule-save-draft');
    AsyncStorage.setItem = real;
    expect(has('capsule-save-failed')).toBe(true);
    type('capsule-message', 'Edited after the failure.');
    await press('capsule-retry');
    const [stored] = ownerCapsules(useCapsuleStore.getState().saved, 'user-a');
    expect(stored.message).toBe('Edited after the failure.');
    act(() => screen.unmount());
    act(() => {
      screen = create(createElement(CapsuleScreen, { capsuleId: stored.id, onPressBack: () => undefined }));
    });
    expect(all('capsule-message')[0].props.value).toBe('Edited after the failure.');
  });

  it('a pending Retry is dropped when the owner changes', async () => {
    await useCapsuleStore.getState().save('user-a', ready());
    const id = ownerCapsules(useCapsuleStore.getState().saved, 'user-a')[0].id;
    act(() => {
      screen = create(createElement(CapsuleScreen, { capsuleId: id, onPressBack: () => undefined }));
    });
    type('capsule-message', 'Unsaved');
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk full'));
    await press('capsule-save-draft');
    AsyncStorage.setItem = real;
    expect(has('capsule-save-failed')).toBe(true);
    act(() => mockOwner.setState({ owner: 'user-b' }));
    expect(has('capsule-save-failed')).toBe(false);
    expect(has('capsule-retry')).toBe(false);
  });

  it('sealed: the message is not shown; early opening needs a confirmation; then reflect', async () => {
    const sealed = seal(editDraft(ready(), { openOn: earliestOpenOn(localDateKey()) }), localDateKey());
    await useCapsuleStore.getState().save('user-a', sealed);
    act(() => {
      screen = create(createElement(CapsuleScreen, { capsuleId: sealed.id, onPressBack: () => undefined }));
    });
    expect(has('capsule-sealed')).toBe(true);
    expect(JSON.stringify(screen.toJSON())).not.toContain('Remember the felt workshop.');
    expect(has('capsule-open')).toBe(false);
    await press('capsule-open-early');
    expect(has('capsule-early-confirm')).toBe(true);
    expect(ownerCapsules(useCapsuleStore.getState().saved, 'user-a')[0].status).toBe('sealed');
    await press('capsule-early-yes');
    expect(ownerCapsules(useCapsuleStore.getState().saved, 'user-a')[0]).toMatchObject({ status: 'opened', openedEarly: true });
    expect(has('capsule-message-opened')).toBe(true);
    type('capsule-reflection', 'Still true.');
    await press('capsule-save-reflection');
    expect(ownerCapsules(useCapsuleStore.getState().saved, 'user-a')[0]).toMatchObject({ message: 'Remember the felt workshop.', reflection: 'Still true.' });
  });

  it("switching accounts hides the previous owner's capsules", async () => {
    await useCapsuleStore.getState().save('user-a', ready());
    act(() => {
      screen = create(createElement(CapsuleListScreen, { onPressBack: () => undefined }));
    });
    expect(screen.root.findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('capsule-row-')).length).toBeGreaterThan(0);
    act(() => mockOwner.setState({ owner: 'user-b' }));
    expect(screen.root.findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('capsule-row-'))).toHaveLength(0);
  });

  it('a missing article keeps its saved title and says Unavailable', async () => {
    const opened = openCapsule(seal(addArticle(addArticle(ready(), { type: 'culture_item', id: 'boz-uy-tunduk', titleSnapshot: 'Tunduk' }), { type: 'culture_item', id: 'gone-article', titleSnapshot: 'A removed article 3k' }), '2026-10-10'), '2026-10-11');
    await useCapsuleStore.getState().save('user-a', opened);
    act(() => {
      screen = create(createElement(CapsuleScreen, { capsuleId: opened.id, onPressBack: () => undefined }));
    });
    expect(JSON.stringify(all('capsule-article-gone-article')[0].children.map((child) => (child as ReactTestInstance).props))).toContain('A removed article 3k');
    expect(JSON.stringify(screen.toJSON())).toContain('timeCapsule.unavailable');
  });
});

describe('custom motifs inside a capsule design', () => {
  const geometry = () => ({ v: 1, name: 'Synthetic star 7c', primitives: [{ kind: 'polygon', points: [[2, 2], [22, 2], [12, 20]] }, { kind: 'circle', cx: 12, cy: 12, r: 4 }, { kind: 'line', x1: 0, y1: 12, x2: 24, y2: 12 }] });
  const customLayer = (custom: unknown = geometry()): MotifLayer => ({ id: 'layerC', motifId: 'custom:cm-synthetic7c', color: '#7A3226', point: { x: 150, y: 90 }, rotation: 30, scale: 1.5, visible: true, custom: custom as MotifLayer['custom'] });

  beforeEach(async () => {
    await AsyncStorage.clear();
    useCapsuleStore.setState({ status: 'ready', saved: {} });
  });

  it('Creator -> capsule -> save -> reopen keeps the custom geometry exactly, beside built-in motifs', async () => {
    const editor = { layers: [layer(60), customLayer()], backgroundColor: '#EADCC0', symmetry: 'mirror' as const };
    offerDesign('user-a', snapshotDesign(editor));
    const capsule = editDraft(ready(), { design: takeOfferedDesign('user-a') });
    expect(await useCapsuleStore.getState().save('user-a', capsule)).toBe(true);
    // Reopen: a restart reads storage through normalizeCapsule.
    useCapsuleStore.setState({ status: 'idle', saved: {} });
    await useCapsuleStore.getState().load();
    const reopened = ownerCapsules(useCapsuleStore.getState().saved, 'user-a')[0].design!;
    expect(reopened.layers[1]).toEqual(customLayer());
    // The built-in layer is unchanged and carries no `custom` field.
    expect(reopened.layers[0]).toEqual(layer(60));
    expect('custom' in reopened.layers[0]).toBe(false);
  });

  it('the snapshot deep-copies nested primitives (later edits to the design cannot reach it)', () => {
    const source = customLayer();
    const snap = snapshotDesign({ layers: [source], backgroundColor: '#EADCC0', symmetry: 'none' });
    const primitives = source.custom!.primitives as { points?: number[][]; r?: number }[];
    primitives[0].points![0][0] = 9;
    primitives[1].r = 11;
    source.custom!.primitives.push({ kind: 'line', x1: 1, y1: 1, x2: 2, y2: 2 });
    expect(snap.layers[0].custom).toEqual(geometry());
    // Normalizing also returns an independent copy.
    const raw = { id: 'tc1', design: { layers: [customLayer()], backgroundColor: '#EADCC0', symmetry: 'none', takenAt: '' } };
    const normalized = normalizeCapsule(raw)!;
    (raw.design.layers[0].custom!.primitives[0] as { points: number[][] }).points[1][1] = 7;
    expect(normalized.design!.layers[0].custom).toEqual(geometry());
  });

  it('an embed this version cannot read is kept (placeholder, never dropped or substituted)', () => {
    const newer = { v: 2, name: 'From a newer app', primitives: [{ kind: 'bezier', d: [1, 2, 3] }] };
    const damaged = { v: 1, name: 'Damaged', primitives: [{ kind: 'circle', cx: 99, cy: 1, r: 1 }] };
    for (const custom of [newer, damaged]) {
      const normalized = normalizeCapsule({ id: 'tc1', design: { layers: [customLayer(custom)], backgroundColor: '#EADCC0', symmetry: 'none', takenAt: '' } })!;
      const kept = normalized.design!.layers[0];
      expect(kept.motifId).toBe('custom:cm-synthetic7c');
      expect(kept.custom).toEqual(custom);
      expect(kept.custom).not.toBe(custom);
    }
    // A custom id with no embed at all stays a custom layer (renders the placeholder).
    const bare = normalizeCapsule({ id: 'tc1', design: { layers: [{ ...customLayer(), custom: undefined }], backgroundColor: '#EADCC0', symmetry: 'none', takenAt: '' } })!;
    expect(bare.design!.layers[0]).toMatchObject({ motifId: 'custom:cm-synthetic7c' });
    expect('custom' in bare.design!.layers[0]).toBe(false);
  });

  it('stray or oversized embeds are bounded; built-in layers never pick one up', () => {
    const huge = { v: 9, name: 'x', primitives: Array.from({ length: 2000 }, (_, i) => ({ kind: 'line', i })) };
    const normalized = normalizeCapsule({ id: 'tc1', design: { layers: [customLayer(huge), { ...layer(30), custom: geometry() }, customLayer('text'), customLayer([1, 2])], backgroundColor: '#EADCC0', symmetry: 'none', takenAt: '' } })!;
    const layers = normalized.design!.layers;
    expect(layers.map((entry) => 'custom' in entry)).toEqual([false, false, false, false]);
    expect(layers[1]).toEqual(layer(30));
  });
});
