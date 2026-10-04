import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager } from '@tanstack/react-query';
import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { queryClient } from '@/services/queryClient';

import {
  cancelRequest,
  EMPTY_QUEUE,
  enqueue,
  itemProgress,
  networkGate,
  nextIntent,
  parsePreference,
  parseQueue,
  rowStatus,
  setStatus,
  summarizeQueue,
  wifiOnlySupported,
  type DownloadQueue,
} from './downloadQueue';
import { requestersOf } from './offlineManifest';
import { cancelPackItems, downloadPackItems, releasePackItems } from './regionPacks';
import { DOWNLOAD_QUEUE_KEY, useOfflineStore } from './useOfflineStore';

jest.mock('@/services/supabase/client', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
const mockFetches: string[] = [];
let mockGate: Promise<void> | null = null;
jest.mock('./offlineQueries', () => {
  const actual = jest.requireActual('./offlineQueries');
  return {
    ...actual,
    fetcherFor: (key: [string, string?]) => {
      if (key[0] === 'culture_item')
        return async () => {
          mockFetches.push(`culture_item:${key[1]}`);
          if (mockGate) await mockGate;
          if (key[1] === 'broken') throw new Error('server error');
          return { id: key[1], title: 'x', image_url: null };
        };
      if (key[0] === 'content_translations') return async () => [];
      return null;
    },
  };
});
jest.mock('expo-image', () => ({ Image: { prefetch: jest.fn(async () => true) } }));

const A = { id: 'culture_item:a', kind: 'culture_item' as const, contentId: 'a' };
const B = { id: 'culture_item:b', kind: 'culture_item' as const, contentId: 'b' };
const at = new Date('2026-10-04T10:00:00Z');
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const store = useOfflineStore.getState;

describe('queue model', () => {
  it('dedupe: the same asset requested by two packs is ONE intent with both owners', () => {
    let queue = enqueue(EMPTY_QUEUE, { ...A, requester: 'region:naryn', priority: 'user' }, at);
    queue = enqueue(queue, { ...A, requester: 'path:boz-uy', priority: 'user' }, at);
    expect(queue.intents).toHaveLength(1);
    expect(queue.intents[0].requesters).toEqual(['region:naryn', 'path:boz-uy']);
    expect(enqueue(queue, { ...A, requester: 'path:boz-uy', priority: 'user' }, at)).toBe(queue);
  });

  it('FIFO, with an explicit user download ahead of background retries; one at a time', () => {
    let queue = enqueue(EMPTY_QUEUE, { ...A, requester: 'user', priority: 'background' }, at);
    queue = enqueue(queue, { ...B, requester: 'user', priority: 'user' }, at);
    expect(nextIntent(queue)?.id).toBe(B.id);
    expect(nextIntent(setStatus(queue, B.id, 'downloading'))).toBeNull();
    // A background item asked for by the user is promoted.
    expect(enqueue(queue, { ...A, requester: 'path:x', priority: 'user' }, at).intents[0].priority).toBe('user');
  });

  it('cancel one owner keeps the intent for the other; final owner cancel removes it', () => {
    let queue = enqueue(EMPTY_QUEUE, { ...A, requester: 'region:naryn', priority: 'user' }, at);
    queue = enqueue(queue, { ...A, requester: 'path:boz-uy', priority: 'user' }, at);
    const first = cancelRequest(queue, A.id, 'region:naryn');
    expect(first.removed).toBe(false);
    expect(first.queue.intents[0].requesters).toEqual(['path:boz-uy']);
    const last = cancelRequest(first.queue, A.id, 'path:boz-uy');
    expect(last.removed).toBe(true);
    expect(last.queue.intents).toEqual([]);
  });

  it('retry: a failed intent asked for again goes back to queued (same intent)', () => {
    const failed = setStatus(enqueue(EMPTY_QUEUE, { ...A, requester: 'user', priority: 'user' }, at), A.id, 'failed', true);
    const retried = enqueue(failed, { ...A, requester: 'user', priority: 'user' }, at);
    expect(retried.intents).toHaveLength(1);
    expect(retried.intents[0]).toMatchObject({ status: 'queued', attempts: 1 });
  });

  it('Wi-Fi only waits on cellular; offline waits for connection; never "failed"', () => {
    expect(networkGate('wifi_only', { isConnected: true, type: 'CELLULAR' }, true)).toBe('waiting_wifi');
    expect(networkGate('wifi_only', { isConnected: true, type: 'WIFI' }, true)).toBe('go');
    expect(networkGate('wifi_only', { isConnected: true, type: 'ETHERNET' }, true)).toBe('go');
    expect(networkGate('wifi_only', { isConnected: true, type: 'VPN' }, true)).toBe('waiting_wifi');
    expect(networkGate('wifi_only', { isConnected: true, type: 'UNKNOWN' }, true)).toBe('waiting_wifi');
    expect(networkGate('any', { isConnected: true, type: 'CELLULAR' }, true)).toBe('go');
    expect(networkGate('any', { isConnected: false, type: 'NONE' }, true)).toBe('waiting_connection');
    const queue = enqueue(EMPTY_QUEUE, { ...A, requester: 'user', priority: 'user' }, at);
    expect(rowStatus(queue.intents[0], 'waiting_wifi')).toBe('waiting_wifi');
    expect(rowStatus(queue.intents[0], 'waiting_connection')).toBe('waiting_connection');
  });

  it('no fake Wi-Fi state: unsupported platforms never apply Wi-Fi only', () => {
    expect(wifiOnlySupported('ios')).toBe(true);
    expect(wifiOnlySupported('android')).toBe(true);
    expect(wifiOnlySupported('web')).toBe(false);
    expect(networkGate('wifi_only', { isConnected: true, type: 'UNKNOWN' }, false)).toBe('go');
    expect(parsePreference('wifi_only')).toBe('wifi_only');
    expect(parsePreference('nonsense')).toBe('any');
    expect(parsePreference(null)).toBe('any');
  });

  it('restart persistence: intents survive, a running item resumes as queued, junk is dropped', () => {
    const queue = setStatus(enqueue(enqueue(EMPTY_QUEUE, { ...A, requester: 'user', priority: 'user' }, at), { ...B, requester: 'region:naryn', priority: 'background' }, at), A.id, 'downloading');
    const restored = parseQueue(JSON.parse(JSON.stringify(queue)));
    expect(restored.intents.map((intent) => `${intent.id}:${intent.status}`)).toEqual(['culture_item:a:queued', 'culture_item:b:queued']);
    expect(parseQueue({ intents: [{ id: 'x', kind: 'journal', contentId: 'secret' }, { ...queue.intents[0], requesters: ['journal:abc'] }, null] }).intents).toEqual([]);
    expect(parseQueue('garbage')).toEqual(EMPTY_QUEUE);
  });

  it('privacy: only public content/download identifiers are stored', () => {
    const queue = enqueue(EMPTY_QUEUE, { ...A, requester: 'user', priority: 'user' }, at);
    expect(Object.keys(queue.intents[0]).sort()).toEqual(['attempts', 'contentId', 'enqueuedAt', 'id', 'kind', 'priority', 'requesters', 'status']);
  });

  it('no fake progress: done-of-total item counts only', () => {
    expect(itemProgress(['a', 'b', 'c'], (id) => id !== 'c')).toEqual({ done: 2, total: 3 });
    const model = fs.readFileSync(path.join(__dirname, 'downloadQueue.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(model).not.toMatch(/percent|bytesDownloaded|estimate/i);
  });
});

describe('queue + existing download (store)', () => {
  afterAll(() => queryClient.clear());
  // A failing fetch should fail now, not after the app's network retry backoff.
  beforeAll(() => queryClient.setDefaultOptions({ queries: { ...queryClient.getDefaultOptions().queries, retry: false } }));
  beforeEach(async () => {
    await AsyncStorage.clear();
    onlineManager.setOnline(true);
    mockFetches.length = 0;
    mockGate = null;
    useOfflineStore.setState({ manifest: { entries: {} }, inFlight: [], failed: [], queue: { intents: [] }, isLoaded: true, appActive: true, network: { isConnected: true, type: 'WIFI' }, preference: 'any', wifiSupported: true });
  });

  it('two requester owners: one fetch, both claims on the single manifest entry', async () => {
    await Promise.all([store().download('culture_item', 'a', 'region:naryn'), store().download('culture_item', 'a', 'path:boz-uy')]);
    expect(mockFetches).toEqual(['culture_item:a']);
    expect(requestersOf(store().manifest.entries['culture_item:a']).sort()).toEqual(['path:boz-uy', 'region:naryn']);
  });

  it('pack items queue together; shared items are claimed, not re-downloaded', async () => {
    const items = [A, B];
    await downloadPackItems('region:naryn', items, store);
    mockFetches.length = 0;
    await downloadPackItems('path:boz-uy', items, store);
    expect(mockFetches).toEqual([]);
    expect(requestersOf(store().manifest.entries[A.id]).sort()).toEqual(['path:boz-uy', 'region:naryn']);
    // Removing one pack keeps shared copies the other needs.
    await releasePackItems('region:naryn', items, store);
    expect(store().manifest.entries[A.id]).toBeDefined();
    await releasePackItems('path:boz-uy', items, store);
    expect(store().manifest.entries[A.id]).toBeUndefined();
  });

  it('Wi-Fi only on cellular: waiting (not failed); resumes automatically when Wi-Fi returns, no duplicate request', async () => {
    useOfflineStore.setState({ preference: 'wifi_only', network: { isConnected: true, type: 'CELLULAR' } });
    const pending = store().download('culture_item', 'a');
    await tick();
    expect(mockFetches).toEqual([]);
    expect(store().failed).toEqual([]);
    expect(summarizeQueue(store().queue, store().gate()).waiting_wifi.map((intent) => intent.id)).toEqual([A.id]);
    store().setRuntime({ network: { isConnected: true, type: 'WIFI' } });
    store().setRuntime({ network: { isConnected: true, type: 'WIFI' } });
    expect(await pending).toBe(true);
    expect(mockFetches).toEqual(['culture_item:a']);
  });

  it('offline: waiting for connection; network resumes the queue', async () => {
    onlineManager.setOnline(false);
    useOfflineStore.setState({ network: { isConnected: false, type: 'NONE' } });
    const pending = store().download('culture_item', 'b');
    await tick();
    expect(store().failed).toEqual([]);
    expect(summarizeQueue(store().queue, store().gate()).waiting_connection).toHaveLength(1);
    onlineManager.setOnline(true);
    store().setRuntime({ network: { isConnected: true, type: 'WIFI' } });
    expect(await pending).toBe(true);
  });

  it('cancel one owner of an in-progress download: the other keeps it; final owner cancel drops the copy', async () => {
    let release!: () => void;
    mockGate = new Promise<void>((resolve) => (release = resolve));
    const first = store().download('culture_item', 'a', 'region:naryn');
    const second = store().download('culture_item', 'a', 'path:boz-uy');
    await tick();
    await store().cancel(A.id, 'region:naryn');
    release();
    await Promise.all([first, second]);
    expect(requestersOf(store().manifest.entries[A.id])).toEqual(['path:boz-uy']);

    mockGate = new Promise<void>((resolve) => (release = resolve));
    const only = store().download('culture_item', 'b', 'region:naryn');
    await tick();
    await cancelPackItems('region:naryn', [B], store);
    expect(await only).toBe(false);
    release();
    await tick();
    await tick();
    expect(store().manifest.entries[B.id]).toBeUndefined();
  });

  it('retry reuses the existing download: failed -> needs attention -> Retry', async () => {
    expect(await store().download('culture_item', 'broken')).toBe(false);
    expect(store().failed).toEqual(['culture_item:broken']);
    expect(summarizeQueue(store().queue, store().gate()).failed).toHaveLength(1);
    expect(await store().download('culture_item', 'broken')).toBe(false);
    expect(store().queue.intents[0].attempts).toBe(2);
    store().dismissFailed('culture_item:broken');
    expect(store().queue.intents).toEqual([]);
  });

  it('restart: the persisted queue is restored by load() and continues', async () => {
    const saved: DownloadQueue = enqueue(EMPTY_QUEUE, { ...A, requester: 'user', priority: 'user' }, at);
    await AsyncStorage.setItem(DOWNLOAD_QUEUE_KEY, JSON.stringify(setStatus(saved, A.id, 'downloading')));
    useOfflineStore.setState({ isLoaded: false, queue: EMPTY_QUEUE });
    await store().load();
    for (let i = 0; i < 10 && !store().manifest.entries[A.id]; i += 1) await tick();
    expect(store().manifest.entries[A.id]).toBeDefined();
    expect(store().queue.intents).toEqual([]);
  });

  it('only while the app is active (no background download claim)', async () => {
    useOfflineStore.setState({ appActive: false });
    const pending = store().download('culture_item', 'a');
    await tick();
    expect(mockFetches).toEqual([]);
    store().setRuntime({ appActive: true });
    expect(await pending).toBe(true);
  });
});

describe('integration', () => {
  const read = (file: string) => fs.readFileSync(path.join(__dirname, '../../..', file), 'utf8');

  it('Storage shows Queued / Downloading / Waiting for Wi-Fi / Needs attention from the same queue, plus Download on', () => {
    const screen = read('src/features/settings/StorageScreen.tsx');
    expect(screen).toContain('summarizeQueue(queue, gate)');
    expect(screen).toContain("(['downloading', 'queued', 'waiting_wifi', 'waiting_connection'] as QueueRowStatus[])");
    expect(screen).toContain("t('downloads.downloadOn')");
    expect(screen).toMatch(/\{wifiSupported \? \(/);
    for (const locale of [kg, ru, en]) for (const status of ['downloading', 'queued', 'waiting_wifi', 'waiting_connection', 'failed'] as const) expect(locale.downloads.status[status]).toBeTruthy();
  });

  it('network source is the existing expo-network state; app foreground gates processing', () => {
    const runtime = read('src/services/offline/useDownloadQueueRuntime.ts');
    expect(runtime).toContain("import { useNetworkState } from 'expo-network'");
    expect(runtime).toContain('wifiOnlySupported(Platform.OS)');
    expect(read('src/app/_layout.tsx')).toContain('useDownloadQueueRuntime();');
  });

  it('one manifest: the queue writes nothing but intents; data still goes through writeManifest/writeQuery', () => {
    const storeSource = read('src/services/offline/useOfflineStore.ts');
    expect((storeSource.match(/AsyncStorage\.setItem\(/g) ?? []).length).toBe(2);
    expect(storeSource).toContain('await writeManifest(manifest);');
  });
});
