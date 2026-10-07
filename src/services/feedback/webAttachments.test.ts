/**
 * Feedback images through the WHOLE submission flow (queue -> storage ->
 * upload -> cleanup), on web (blob: picks) and native (files). The upload
 * endpoint is mocked and records the bytes it receives.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { buildDiagnostics } from './diagnostics';
import { FEEDBACK_QUEUE_KEY, flushFeedbackQueue, readFeedbackQueue, sendFeedbackReport } from './feedbackQueue';
import { __setDurableAttachmentStoreForTests, type AttachmentStore, webAttachmentUri } from './webAttachments';

const mockUploads: { path: string; bytes: number[] }[] = [];
const mockSent: Record<string, unknown>[] = [];
jest.mock('@/services/supabase/client', () => ({
  supabase: {
    rpc: jest.fn(async (_fn: string, args: Record<string, unknown>) => (mockSent.push(args), { data: 'ok', error: null })),
    storage: { from: () => ({ upload: jest.fn(async (path: string, body: ArrayBuffer) => (mockUploads.push({ path, bytes: Array.from(new Uint8Array(body)) }), { data: { path }, error: null })) }) },
  },
}));

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]).buffer;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2]).buffer;
const BLOB = 'blob:http://localhost:4173/7d6c-synthetic';
const sources = new Map<string, ArrayBuffer>();

/** A durable store that survives a "reload" (like IndexedDB). */
function fakeIndexedDb(): AttachmentStore & { data: Map<string, ArrayBuffer> } {
  const data = new Map<string, ArrayBuffer>();
  return { data, put: async (id, bytes) => (data.set(id, bytes), true), get: async (id) => data.get(id) ?? null, remove: async (id) => void data.delete(id) };
}

const input = (screenshotUri: string | null) => ({
  category: 'bug' as const,
  message: 'Map froze',
  diagnostics: buildDiagnostics({ language: 'en', ageMode: null, online: true }),
  screenshotUri,
  accountId: null,
});
const online = { online: true, currentAccountId: null };
const offline = { online: false, currentAccountId: null };

beforeEach(async () => {
  await AsyncStorage.clear();
  mockUploads.length = 0;
  mockSent.length = 0;
  sources.clear();
  sources.set(BLOB, JPEG);
  (globalThis as { fetch?: unknown }).fetch = jest.fn(async (uri: string) => {
    const bytes = sources.get(uri);
    if (!bytes) throw new Error('gone');
    return { arrayBuffer: async () => bytes };
  });
});

describe('web: a selected JPEG reaches the upload endpoint', () => {
  it('online: uploaded with the report, bytes intact, storage cleaned up', async () => {
    const store = fakeIndexedDb();
    __setDurableAttachmentStoreForTests(store);
    const outcome = await sendFeedbackReport(input(BLOB), online);
    expect(outcome).toMatchObject({ result: 'sent', attachment: 'sent' });
    expect(mockUploads).toEqual([{ path: `screenshots/${outcome.clientReportId}.jpg`, bytes: Array.from(new Uint8Array(JPEG)) }]);
    expect(mockSent[0].p_screenshot_path).toBe(`screenshots/${outcome.clientReportId}.jpg`);
    expect(store.data.size).toBe(0);
  });

  it('offline, then a page reload: the stored image still goes out with the report', async () => {
    const store = fakeIndexedDb();
    __setDurableAttachmentStoreForTests(store);
    const outcome = await sendFeedbackReport(input(BLOB), offline);
    expect(outcome).toMatchObject({ result: 'queued', attachment: 'kept' });
    // What the queue stores: an internal reference, never the blob URL.
    const stored = await AsyncStorage.getItem(FEEDBACK_QUEUE_KEY);
    expect(stored).toContain(webAttachmentUri(outcome.clientReportId));
    expect(stored).not.toContain('blob:');
    // Reload: the blob URL is dead, in-memory state gone; IndexedDB stays.
    sources.clear();
    __setDurableAttachmentStoreForTests(store);
    await flushFeedbackQueue(null);
    expect(mockUploads).toHaveLength(1);
    expect(mockSent[0].p_screenshot_path).toBe(`screenshots/${outcome.clientReportId}.jpg`);
    expect(store.data.size).toBe(0);
  });

  it('no IndexedDB: the sheet is told it is page-only; after a reload the report goes without it, marked', async () => {
    __setDurableAttachmentStoreForTests(null);
    const queued = await sendFeedbackReport(input(BLOB), offline);
    expect(queued.attachment).toBe('session_only');
    // Same page, back online: still sent with the image.
    await flushFeedbackQueue(null);
    expect(mockUploads).toHaveLength(1);

    const again = await sendFeedbackReport(input(BLOB), offline);
    expect(again.attachment).toBe('session_only');
    __setDurableAttachmentStoreForTests(null); // reload: memory gone
    await flushFeedbackQueue(null);
    expect(mockUploads).toHaveLength(1); // no second upload
    expect(mockSent.at(-1)).toMatchObject({ p_screenshot_path: null, p_diagnostics: expect.objectContaining({ screenshot: 'not_uploaded' }) });
  });

  it('online with a missing image: sent, and the sheet says it went without it', async () => {
    __setDurableAttachmentStoreForTests(null);
    const unreadable = 'blob:http://localhost:4173/revoked';
    const outcome = await sendFeedbackReport(input(unreadable), online);
    expect(outcome).toMatchObject({ result: 'sent', attachment: 'dropped' });
    expect(mockUploads).toEqual([]);
  });

  it('a non-JPEG (by its bytes) is not kept - and the sheet is told', async () => {
    __setDurableAttachmentStoreForTests(fakeIndexedDb());
    sources.set(BLOB, PNG);
    const outcome = await sendFeedbackReport(input(BLOB), offline);
    expect(outcome.attachment).toBe('dropped');
    expect((await readFeedbackQueue())[0].screenshotUri).toBeNull();
  });
});

describe('unsafe images stay rejected', () => {
  const stored = (screenshotUri: string, id = '6f1c2a4e-8b3d-4c5e-9f70-1a2b3c4d5e6f') => ({ clientReportId: id, createdAt: '2026-10-06T08:00:00.000Z', category: 'bug', message: 'x', diagnostics: {}, screenshotUri, screenshotPath: null, accountId: null, attempts: 0 });

  it.each([
    ['blob URL read back from storage', BLOB],
    ['data URL read back from storage', 'data:image/jpeg;base64,/9j/4AAQ'],
    ['remote URL', 'https://evil.example/x.jpg'],
    ["another report's stored image", webAttachmentUri('7a2b3c4d-1e2f-4a5b-8c9d-0e1f2a3b4c5d')],
    ['malformed reference', 'oyno-attachment:../../x'],
    ['journal photo', 'file:///Documents/journal/user-a/e1-v1.jpg'],
  ])('%s', async (_label, uri) => {
    await AsyncStorage.setItem(FEEDBACK_QUEUE_KEY, JSON.stringify([stored(uri)]));
    expect((await readFeedbackQueue())[0].screenshotUri).toBeNull();
    await flushFeedbackQueue(null);
    expect(mockUploads).toEqual([]);
  });

  it('a pick that is not a blob:/data:image/jpeg source is never adopted as a web image', async () => {
    __setDurableAttachmentStoreForTests(fakeIndexedDb());
    const outcome = await sendFeedbackReport(input('data:text/html;base64,PHNjcmlwdD4='), offline);
    expect(outcome.attachment).toBe('dropped');
  });
});

describe('native attachments still work', () => {
  it('a cache capture is kept, uploaded and reported as sent', async () => {
    const original = Platform.OS;
    try {
      const capture = 'file:///var/mobile/Library/Caches/ImageManipulator/capture.jpg';
      sources.set(capture, JPEG);
      const outcome = await sendFeedbackReport(input(capture), online);
      expect(outcome).toMatchObject({ result: 'sent', attachment: 'sent' });
      expect(mockUploads).toHaveLength(1);
    } finally {
      Object.defineProperty(Platform, 'OS', { value: original });
    }
  });
});
