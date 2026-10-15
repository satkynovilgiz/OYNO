/** Project workspaces: reference resolution, actions, ownership, notes kept through pending/failed saves, drafts vs. saved records. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { listRecovery } from '@/features/recovery/recoveryModel';
import { discardEntry, retryEntry } from '@/features/recovery/recoveryActions';
import type { ShelfItem, ShelfType, SourceState } from '@/features/shelf/shelfModel';
import { draftMap, ownerKey } from '@/services/drafts/draftRegistry';
import { routeExists } from '@/test-utils/routeExists';
import { useMyCollectionsStore } from '@/store/useMyCollectionsStore';
import { ownerWorkspaces, useWorkspaceStore, WORKSPACES_KEY } from '@/store/useWorkspaceStore';

import { actionsFor, applyWorkspaceChange, MAX_WORKSPACES, NOTE_MAX, normalizeWorkspaces, noteState, parseProjectKey, projectKey, recentWorkspaces, relatedDrafts, resolveProject, type OwnerWorkspaces } from './workspaceModel';
import { WorkspaceScreen } from './WorkspaceScreen';

jest.mock('@/services/supabase/client', () => ({ supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }), getSession: async () => ({ data: { session: null } }) } } }));
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({ t: (key: string, params?: Record<string, unknown>) => (params?.name ? `${key}:${String(params.name)}` : key), i18n: { language: 'en' } }),
}));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() }, useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, []) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/features/games/records/useGameRecords', () => {
  const owner = jest.requireActual('zustand').create(() => ({ owner: 'user-a' }));
  return { mockOwner: owner, useRecordsOwner: () => owner((state: { owner: string }) => state.owner) };
});
const mockOwner = (jest.requireMock('@/features/games/records/useGameRecords') as { mockOwner: { setState: (state: { owner: string }) => void } }).mockOwner;
const DESIGN = {
  id: 'd1',
  name: 'Felt corner',
  layers: [{ id: 'l0', motifId: 'gul', color: '#2F5233', point: { x: 150, y: 150 }, rotation: 0, scale: 1, visible: true }],
  background_color: '#EADCC0',
  symmetry_mode: 'none',
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-05T10:00:00Z',
};
jest.mock('@tanstack/react-query', () => ({ useQuery: ({ enabled }: { enabled: boolean }) => (enabled ? { data: [DESIGN] } : { data: undefined }) }));
// The project sources (the Shelf adapters) - controlled per test.
let mockSources: Record<string, unknown> = {};
jest.mock('@/features/shelf/useShelfSources', () => ({ useShelfSources: () => mockSources }));
jest.mock('@/features/myCollections/useMyCollections', () => ({ useMyCollections: () => ({ data: { collections: [], items: [] }, owner: 'user-a', isLoaded: true }), useContentResolver: () => ({ resolve: () => null, ready: true }) }));
const mockShare = jest.fn();
jest.mock('@/services/share/useShareCard', () => ({ useShareCard: () => ({ share: mockShare, shareHost: null }) }));
jest.mock('@/features/culture/oymo/components/OymoArtwork', () => ({ OymoArtwork: () => null }));
jest.mock('@/features/culture/oymo/components/OymoCanvas', () => ({ CANVAS_SIZE: 300 }));
jest.mock('@/components/feedback/SaveStatus', () => {
  const React = jest.requireActual('react');
  return {
    useSaveFeedback: () => {
      const [state, setState] = React.useState('idle');
      return {
        state,
        saving: state === 'saving',
        run: async (save: () => Promise<boolean>) => {
          setState('saving');
          const ok = await save();
          setState(ok ? 'saved' : 'failed');
          return ok;
        },
      };
    },
    SaveStatus: (props: { state: string; testID: string }) => React.createElement('SaveStatus', { testID: `${props.testID}-${props.state}` }),
  };
});
jest.mock('@/components/ui', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    AnimatedPressable: (props: Record<string, unknown>) => h('AnimatedPressable', props, props.children),
    Button: (props: Record<string, unknown>) => h('Button', props, props.label),
    IconButton: (props: Record<string, unknown>) => h('IconButton', props),
    TextButton: (props: Record<string, unknown>) => h('TextButton', props),
    TextField: (props: Record<string, unknown>) => h('TextField', props),
    ConfirmationModal: (props: Record<string, unknown>) => (props.visible ? h('ConfirmationModal', props) : null),
  };
});

const AT = '2026-10-10T10:00:00.000Z';
const shelfItem = (type: ShelfType, id: string, title: string | null): ShelfItem => ({
  key: `${type}:${id}`,
  type,
  id,
  title,
  createdAt: AT,
  updatedAt: AT,
  route: '/',
  storage: type === 'design' ? 'cloud' : 'device',
  detail: { key: 'x', params: { count: 2 } },
});
const sources = (patch: Partial<Record<ShelfType, SourceState>> = {}): Record<ShelfType, SourceState> => ({
  design: { status: 'ready', items: [shelfItem('design', 'd1', 'Felt corner')] },
  exhibition: { status: 'ready', items: [shelfItem('exhibition', 'uc_1', 'Yurt things')] },
  board: { status: 'ready', items: [] },
  capsule: { status: 'ready', items: [] },
  ...patch,
});

describe('references and resolution', () => {
  it('keys are the Shelf keys; only designs and exhibitions with safe ids are accepted', () => {
    expect(projectKey({ type: 'design', id: 'd1' })).toBe('design:d1');
    expect(parseProjectKey('exhibition:uc_1')).toEqual({ type: 'exhibition', id: 'uc_1' });
    for (const bad of ['board:b1', 'capsule:c1', 'design:', 'design:../x', ':d1', 'design', 42]) expect(parseProjectKey(bad)).toBeNull();
  });

  it('a reference resolves to the live record; only a READY source can say "missing"', () => {
    const ref = { type: 'design' as const, id: 'd1' };
    expect(resolveProject(ref, sources())).toMatchObject({ status: 'ready', item: { title: 'Felt corner' } });
    expect(resolveProject({ type: 'design', id: 'gone' }, sources())).toEqual({ status: 'missing' });
    expect(resolveProject(ref, sources({ design: { status: 'loading' } }))).toEqual({ status: 'loading' });
    expect(resolveProject(ref, sources({ design: { status: 'unavailable', reason: 'signedOut' } }))).toEqual({ status: 'unavailable', reason: 'signedOut' });
    const retry = jest.fn();
    expect(resolveProject(ref, sources({ design: { status: 'error', retry } }))).toEqual({ status: 'error', retry });
  });

  it('actions are the ones the type supports, and each route opens an existing screen with the project id', () => {
    const design = actionsFor({ type: 'design', id: 'd1' });
    expect(design.map((group) => [group.id, group.actions.map((action) => action.id)])).toEqual([
      ['edit', ['edit', 'milestones']],
      ['preview', ['surfaces']],
      ['export', ['postcard', 'share']],
    ]);
    const exhibition = actionsFor({ type: 'exhibition', id: 'uc_1' });
    expect(exhibition.map((group) => [group.id, group.actions.map((action) => action.id)])).toEqual([
      ['edit', ['edit', 'collection']],
      ['preview', ['visitorPreview']],
      ['export', ['share']],
    ]);
    const routes = [...design, ...exhibition].flatMap((group) => group.actions).flatMap((action) => (action.kind === 'route' ? [action.route] : []));
    expect(routes).toEqual(['/culture/oymo/create?creation=d1', '/culture/oymo/milestones/d1', '/culture/oymo/postcard?pattern=d1', '/profile/my-collections/museum?collection=uc_1', '/profile/my-collections/uc_1']);
    for (const route of [...routes, '/culture/oymo/preview', '/profile/workspaces', '/profile/workspaces/design:d1']) expect(routeExists(route)).toBe(true);
  });
});

describe('workspace records', () => {
  it('add, note, open and remove; bounded; the note is capped; normalization drops junk', () => {
    let state: OwnerWorkspaces = {};
    state = applyWorkspaceChange(state, { kind: 'add', ref: { type: 'design', id: 'd1' }, title: 'Felt corner', now: AT })!;
    expect(state['design:d1']).toEqual({ type: 'design', id: 'd1', note: '', titleSnapshot: 'Felt corner', createdAt: AT, updatedAt: AT, openedAt: AT });
    // Adding again only re-opens it (no duplicate, note kept).
    state = applyWorkspaceChange(state, { kind: 'note', key: 'design:d1', note: 'x'.repeat(NOTE_MAX + 50), now: AT })!;
    expect(state['design:d1'].note).toHaveLength(NOTE_MAX);
    const again = applyWorkspaceChange(state, { kind: 'add', ref: { type: 'design', id: 'd1' }, title: 'Renamed', now: '2026-10-11T00:00:00.000Z' })!;
    expect(Object.keys(again)).toEqual(['design:d1']);
    expect(again['design:d1']).toMatchObject({ note: 'x'.repeat(NOTE_MAX), titleSnapshot: 'Renamed', openedAt: '2026-10-11T00:00:00.000Z' });
    expect(applyWorkspaceChange(again, { kind: 'note', key: 'design:nope', note: 'a', now: AT })).toBeNull();
    expect(applyWorkspaceChange(again, { kind: 'remove', key: 'design:d1' })).toEqual({});

    let full: OwnerWorkspaces = {};
    for (let i = 0; i < MAX_WORKSPACES; i++) full = applyWorkspaceChange(full, { kind: 'add', ref: { type: 'exhibition', id: `uc_${i}` }, title: '', now: AT })!;
    expect(applyWorkspaceChange(full, { kind: 'add', ref: { type: 'design', id: 'one-more' }, title: '', now: AT })).toBeNull();

    expect(normalizeWorkspaces({ 'design:d1': { type: 'design', id: 'd1', note: 5 }, 'board:b1': { type: 'board', id: 'b1' }, 'design:d2': { type: 'exhibition', id: 'd2' } })).toEqual({
      'design:d1': expect.objectContaining({ note: '', titleSnapshot: '' }),
    });
  });

  it('recently opened first', () => {
    const state = { a: { type: 'design', id: 'a', openedAt: '2026-10-01T00:00:00Z' }, b: { type: 'design', id: 'b', openedAt: '2026-10-03T00:00:00Z' } } as unknown as OwnerWorkspaces;
    expect(recentWorkspaces(state).map((entry) => entry.id)).toEqual(['b', 'a']);
  });

  it('drafts: the note state and the portfolio drafts that include this design (never for exhibitions)', () => {
    expect(noteState('same', 'same')).toBe('clean');
    expect(noteState('typed', 'stored')).toBe('unsaved');
    const drafts = [
      { id: 'p1', title: 'Spring', entries: [{ creationId: 'd1' }] },
      { id: 'p2', title: 'Other', entries: [{ creationId: 'd9' }] },
    ];
    expect(relatedDrafts({ type: 'design', id: 'd1' }, drafts)).toEqual([{ id: 'portfolio:p1', kind: 'portfolio', title: 'Spring', route: '/profile/oymo-portfolios/p1' }]);
    expect(relatedDrafts({ type: 'exhibition', id: 'd1' }, drafts)).toEqual([]);
  });
});

describe('the store: owners, serialized write-first, failures', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useWorkspaceStore.setState({ status: 'ready', saved: {} });
  });

  it('per owner; survives a restart; a note never touches the project source', async () => {
    const museumsBefore = JSON.stringify(useMyCollectionsStore.getState().museums);
    expect(await useWorkspaceStore.getState().change('user-a', { kind: 'add', ref: { type: 'exhibition', id: 'uc_1' }, title: 'Yurt things', now: AT })).toBe(true);
    expect(await useWorkspaceStore.getState().change('user-a', { kind: 'note', key: 'exhibition:uc_1', note: 'Move the felt first', now: AT })).toBe(true);
    expect(ownerWorkspaces(useWorkspaceStore.getState().saved, 'user-b')).toEqual({});
    useWorkspaceStore.setState({ status: 'idle', saved: {} });
    await useWorkspaceStore.getState().load();
    expect(ownerWorkspaces(useWorkspaceStore.getState().saved, 'user-a')['exhibition:uc_1'].note).toBe('Move the felt first');
    expect(JSON.stringify(useMyCollectionsStore.getState().museums)).toBe(museumsBefore);
    expect(Object.keys(JSON.parse((await AsyncStorage.getItem(WORKSPACES_KEY))!))).toEqual(['user-a']);
  });

  it('rapid changes are serialized from the latest state', async () => {
    await useWorkspaceStore.getState().change('user-a', { kind: 'add', ref: { type: 'design', id: 'd1' }, title: '', now: AT });
    await Promise.all(['a', 'ab', 'abc'].map((note) => useWorkspaceStore.getState().change('user-a', { kind: 'note', key: 'design:d1', note, now: AT })));
    expect(ownerWorkspaces(useWorkspaceStore.getState().saved, 'user-a')['design:d1'].note).toBe('abc');
    expect(JSON.parse((await AsyncStorage.getItem(WORKSPACES_KEY))!)['user-a']['design:d1'].note).toBe('abc');
  });

  it('a failed write changes nothing; unreadable storage is an error that blocks writes', async () => {
    await useWorkspaceStore.getState().change('user-a', { kind: 'add', ref: { type: 'design', id: 'd1' }, title: '', now: AT });
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk full'));
    expect(await useWorkspaceStore.getState().change('user-a', { kind: 'note', key: 'design:d1', note: 'lost?', now: AT })).toBe(false);
    AsyncStorage.setItem = real;
    expect(ownerWorkspaces(useWorkspaceStore.getState().saved, 'user-a')['design:d1'].note).toBe('');

    await AsyncStorage.setItem(WORKSPACES_KEY, '{not json');
    useWorkspaceStore.setState({ status: 'idle', saved: {} });
    await useWorkspaceStore.getState().load();
    expect(useWorkspaceStore.getState().status).toBe('error');
    expect(await useWorkspaceStore.getState().change('user-a', { kind: 'add', ref: { type: 'design', id: 'd2' }, title: '', now: AT })).toBe(false);
    expect(await AsyncStorage.getItem(WORKSPACES_KEY)).toBe('{not json');
  });
});

describe('Recovery Center: an unsaved workspace note', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    draftMap('workspaceNote').clear();
    useWorkspaceStore.setState({ status: 'ready', saved: {} });
    await useWorkspaceStore.getState().change('user-a', { kind: 'add', ref: { type: 'design', id: 'd1' }, title: 'Felt corner', now: AT });
  });
  const list = (owner: string, exists: (key: string) => boolean | undefined) =>
    listRecovery({
      owner,
      portfolioExists: () => undefined,
      scrapbookExists: () => undefined,
      question: () => undefined,
      comparison: () => undefined,
      journalDrafts: [],
      journalEntryExists: () => undefined,
      firstUse: null,
      workspaceExists: exists,
    });

  it('is listed for its owner only, as unsaved, with a safe Retry; a removed workspace can only be discarded', () => {
    draftMap('workspaceNote').set(ownerKey('user-a', 'design:d1'), { note: 'Draft words', title: 'Felt corner' });
    expect(list('user-b', () => true)).toEqual([]);
    expect(list('user-a', () => true)).toEqual([{ id: 'workspaceNote:design:d1', kind: 'workspaceNote', state: 'unsaved', survivesRestart: false, title: 'Felt corner', parent: 'ok', route: '/profile/workspaces/design%3Ad1', retry: true }]);
    expect(list('user-a', () => false)[0]).toMatchObject({ parent: 'missing', retry: false });
    expect(list('user-a', () => undefined)[0]).toMatchObject({ parent: 'loading', retry: false });
  });

  it('Retry saves the note as it is now and keeps a newer edit; Discard removes only the draft', async () => {
    const map = draftMap<{ note: string; title: string }>('workspaceNote');
    map.set(ownerKey('user-a', 'design:d1'), { note: 'First words', title: 'Felt corner' });
    const [entry] = list('user-a', () => true);
    expect(await retryEntry('user-a', entry)).toBe(true);
    expect(ownerWorkspaces(useWorkspaceStore.getState().saved, 'user-a')['design:d1'].note).toBe('First words');
    expect(map.has(ownerKey('user-a', 'design:d1'))).toBe(false);

    map.set(ownerKey('user-a', 'design:d1'), { note: 'Second', title: 'Felt corner' });
    await discardEntry('user-a', entry);
    expect(map.has(ownerKey('user-a', 'design:d1'))).toBe(false);
    expect(ownerWorkspaces(useWorkspaceStore.getState().saved, 'user-a')['design:d1'].note).toBe('First words');
  });
});

describe('the screen', () => {
  let screen: ReactTestRenderer;
  const router = (jest.requireMock('expo-router') as { router: { push: jest.Mock; replace: jest.Mock } }).router;
  const byId = (id: string) => screen.root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
  const has = (id: string) => byId(id).length > 0;
  const one = (id: string) => byId(id)[0] as ReactTestInstance;
  const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  const render = async (key = 'design:d1') => {
    await act(async () => {
      screen = create(createElement(WorkspaceScreen, { projectKey: key, onPressBack: () => undefined }));
    });
    await flush();
  };

  beforeEach(async () => {
    await AsyncStorage.clear();
    draftMap('workspaceNote').clear();
    mockShare.mockClear();
    router.push.mockClear();
    mockOwner.setState({ owner: 'user-a' });
    mockSources = sources();
    useWorkspaceStore.setState({ status: 'ready', saved: {} });
    await useWorkspaceStore.getState().change('user-a', { kind: 'add', ref: { type: 'design', id: 'd1' }, title: 'Felt corner', now: AT });
    await useWorkspaceStore.getState().change('user-a', { kind: 'note', key: 'design:d1', note: 'Stored note', now: AT });
  });

  it('shows the project, its grouped actions, and opens the right existing screens', async () => {
    await render();
    expect(one('workspace-project-title').props.children).toBe('Felt corner');
    expect(['workspace-group-edit', 'workspace-group-preview', 'workspace-group-export'].every(has)).toBe(true);
    expect(one('workspace-group-edit').props['aria-label']).toBe('workspace.groups.edit');
    act(() => one('workspace-action-edit').props.onPress());
    expect(router.push).toHaveBeenLastCalledWith('/culture/oymo/create?creation=d1');
    act(() => one('workspace-action-postcard').props.onPress());
    expect(router.push).toHaveBeenLastCalledWith('/culture/oymo/postcard?pattern=d1');
    // The saved record is shown apart from drafts.
    expect(has('workspace-saved-record')).toBe(true);
    expect(has('workspace-drafts')).toBe(true);
  });

  it('export never carries the private note', async () => {
    await render();
    act(() => one('workspace-action-share').props.onPress());
    expect(mockShare).toHaveBeenCalledTimes(1);
    const [content] = mockShare.mock.calls[0];
    expect(content).toMatchObject({ variant: 'creation', title: 'Felt corner' });
    expect(JSON.stringify(content, (key, value) => (key === 'artwork' ? undefined : value))).not.toContain('Stored note');
  });

  it('an edit typed while the save is pending is kept (unsaved), and the draft holds it', async () => {
    await render();
    expect(one('workspace-note-input').props.value).toBe('Stored note');
    act(() => one('workspace-note-input').props.onChangeText('First version'));
    expect(one('workspace-note-state').props.children).toBe('workspace.noteUnsaved');
    let release!: () => void;
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = (...args: Parameters<typeof real>) => new Promise<void>((resolve) => (release = () => void real(...args).then(resolve)));
    let pending!: Promise<void>;
    act(() => {
      pending = one('workspace-note-save').props.onPress();
    });
    act(() => one('workspace-note-input').props.onChangeText('First version, then more'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      release();
      await pending;
    });
    AsyncStorage.setItem = real;
    await flush();
    expect(ownerWorkspaces(useWorkspaceStore.getState().saved, 'user-a')['design:d1'].note).toBe('First version');
    expect(one('workspace-note-input').props.value).toBe('First version, then more');
    expect(one('workspace-note-state').props.children).toBe('workspace.noteUnsaved');
    expect(draftMap<{ note: string }>('workspaceNote').get(ownerKey('user-a', 'design:d1'))?.note).toBe('First version, then more');
  });

  it('a failed save keeps the text, says so, and leaves a recoverable draft', async () => {
    await render();
    act(() => one('workspace-note-input').props.onChangeText('Not yet saved'));
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk full'));
    await act(async () => {
      await one('workspace-note-save').props.onPress();
    });
    AsyncStorage.setItem = real;
    expect(has('workspace-note-failed')).toBe(true);
    expect(one('workspace-note-input').props.value).toBe('Not yet saved');
    expect(ownerWorkspaces(useWorkspaceStore.getState().saved, 'user-a')['design:d1'].note).toBe('Stored note');
    expect(draftMap<{ note: string }>('workspaceNote').get(ownerKey('user-a', 'design:d1'))?.note).toBe('Not yet saved');
  });

  it('a deleted project is "unavailable" with Remove and the Shelf - never shown as loading or as an editable project', async () => {
    mockSources = sources({ design: { status: 'ready', items: [] } });
    await render();
    expect(has('workspace-project-missing')).toBe(true);
    expect(has('workspace-action-edit')).toBe(false);
    // The note stays readable; removing needs confirmation.
    expect(one('workspace-note-input').props.value).toBe('Stored note');
    mockSources = sources({ design: { status: 'loading' } });
    await render();
    expect(has('workspace-project-missing')).toBe(false);
    expect(has('workspace-project-loading')).toBe(true);
  });

  it('switching account hides the previous owner’s workspace and note at once', async () => {
    await render();
    act(() => one('workspace-note-input').props.onChangeText('Private to user A'));
    act(() => mockOwner.setState({ owner: 'user-b' }));
    await flush();
    expect(has('workspace-note-input')).toBe(false);
    expect(has('workspace-add')).toBe(true);
    expect(JSON.stringify(screen.toJSON())).not.toContain('Private to user A');
    expect(JSON.stringify(screen.toJSON())).not.toContain('Stored note');
  });

  it('an invalid key is "not found"', async () => {
    await render('board:b1');
    expect(has('state-notFound')).toBe(true);
  });
});
