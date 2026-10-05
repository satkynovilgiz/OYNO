/**
 * Behavioural tests for the native Memory Book export lifecycle. Expo
 * Print, Sharing and FileSystem are replaced at their API boundaries by an
 * in-memory fake (no native rendering happens here - real-device QA is in
 * docs/DEVICE_QA.md). The REAL account-generation module runs against a
 * small stand-in auth store, so session changes behave as in the app.
 */
import { act } from 'react';

import type { JournalEntry } from '../journalModel';

// ---------------------------------------------------------------------
// In-memory file system + controllable Print / Sharing
// ---------------------------------------------------------------------
type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void };
function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const mockFs = {
  files: new Map<string, string>(),
  dirs: new Set<string>(),
  log: [] as string[],
  copyGate: null as Promise<void> | null,
  failCopy: false,
};

jest.mock('expo-file-system', () => {
  const join = (parent: unknown, name?: string) => (name === undefined ? String(parent) : `${(parent as { uri: string }).uri}/${name}`);
  class Directory {
    uri: string;
    constructor(parent: unknown, name?: string) {
      this.uri = join(parent, name);
    }
    get exists() {
      return mockFs.dirs.has(this.uri);
    }
    create() {
      mockFs.dirs.add(this.uri);
      mockFs.log.push(`mkdir ${this.uri}`);
    }
    delete() {
      mockFs.dirs.delete(this.uri);
      for (const key of [...mockFs.files.keys()]) if (key.startsWith(`${this.uri}/`)) mockFs.files.delete(key);
      mockFs.log.push(`rmdir ${this.uri}`);
    }
  }
  class File {
    uri: string;
    constructor(parent: unknown, name?: string) {
      this.uri = join(parent, name);
    }
    get exists() {
      return mockFs.files.has(this.uri);
    }
    async copy(destination: { uri: string }) {
      mockFs.log.push(`copy ${this.uri} -> ${destination.uri}`);
      if (mockFs.copyGate) await mockFs.copyGate;
      if (mockFs.failCopy) throw new Error('disk full');
      mockFs.files.set(destination.uri, mockFs.files.get(this.uri) ?? '');
    }
    delete() {
      mockFs.files.delete(this.uri);
      mockFs.log.push(`rm ${this.uri}`);
    }
    async base64() {
      return Buffer.from(mockFs.files.get(this.uri) ?? '').toString('base64');
    }
  }
  return { File, Directory, Paths: { cache: new Directory('cache') } };
});

let mockPrintCount = 0;
const mockPrintGates: Deferred<void>[] = [];
const mockPrintToFile = jest.fn(async (_options: { html: string }) => {
  mockPrintCount += 1;
  const uri = `cache/Print/print-${mockPrintCount}.pdf`;
  const gate = mockPrintGates.shift();
  if (gate) await gate.promise;
  mockFs.files.set(uri, 'PDF');
  mockFs.log.push(`print ${uri}`);
  return { uri, numberOfPages: 1 };
});
jest.mock('expo-print', () => ({ printToFileAsync: (options: { html: string }) => mockPrintToFile(options) }));

const mockIsAvailable = jest.fn(async () => true);
const mockShare = jest.fn(async (_uri: string, _options?: unknown): Promise<void> => undefined);
jest.mock('expo-sharing', () => ({ isAvailableAsync: () => mockIsAvailable(), shareAsync: (uri: string, options?: unknown) => mockShare(uri, options) }));

// ---------------------------------------------------------------------
// Account session (real accountGeneration over a stand-in auth store)
// ---------------------------------------------------------------------
jest.mock('@/store/useAuthStore', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { create } = require('zustand');
  return { useAuthStore: create(() => ({ status: 'authenticated', user: { id: 'user-a' } })) };
});
jest.mock('@/store/useJournalStore', () => ({
  currentPhotoOwner: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAuthStore } = require('@/store/useAuthStore');
    const { status, user } = useAuthStore.getState();
    return status === 'authenticated' && user?.id ? user.id : 'guest';
  },
}));
const mockTrack = jest.fn();
jest.mock('@/services/analytics/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));
const mockDownload = jest.fn<Promise<string | null>, [string, string, string, string]>();
const mockDeleteLocal = jest.fn();
jest.mock('@/services/journal/journalPhotos', () => ({
  downloadPhoto: (...args: [string, string, string, string]) => mockDownload(...args),
  deleteLocalPhoto: (...args: unknown[]) => mockDeleteLocal(...args),
  journalPhotosSupported: () => true,
}));

// eslint-disable-next-line import/first
import { useAuthStore } from '@/store/useAuthStore';

import { createPhotoCache, exportMemoryBook, photoCacheValid, prepareMemoryBook, shareMemoryBook } from './memoryBookExport';
import { reviewItems, reviewPhotoState } from './memoryBookModel';
import { ExportCancelledError, generateAndShareBook, SharingUnavailableError, type ExportSession } from './memoryBookService';

const signIn = (id: string) => useAuthStore.setState({ status: 'authenticated', user: { id } as never });
const signOut = () => useAuthStore.setState({ status: 'unauthenticated', user: null });
const valid: ExportSession = { isValid: () => true };
const leftovers = () => ({ files: [...mockFs.files.keys()].filter((key) => key.startsWith('cache/')), dirs: [...mockFs.dirs].filter((key) => key !== 'cache') });

const entry = (id: string, extra: Partial<JournalEntry> = {}): JournalEntry => ({
  id,
  title: `Memory ${id}`,
  note: 'note',
  date: '2026-10-04',
  photo: null,
  link: null,
  createdAt: '2026-10-04T00:00:00Z',
  updatedAt: '2026-10-04T00:00:00Z',
  deletedAt: null,
  ...extra,
});
const runExport = (entries: JournalEntry[]) =>
  exportMemoryBook({ entries, includeText: true, layout: 'classic', formatDate: (date) => date, buildHtml: (pages) => `<html>${pages.length}</html>`, today: '2026-10-04' });

beforeEach(() => {
  mockFs.files.clear();
  mockFs.dirs.clear();
  mockFs.log.length = 0;
  mockFs.copyGate = null;
  mockFs.failCopy = false;
  mockPrintGates.length = 0;
  mockPrintToFile.mockClear();
  mockIsAvailable.mockReset().mockResolvedValue(true);
  mockShare.mockReset().mockResolvedValue(undefined);
  mockTrack.mockClear();
  mockDownload.mockReset();
  mockDeleteLocal.mockClear();
  signIn('user-a');
});

describe('generateAndShareBook - native lifecycle', () => {
  it('success: print -> copy -> share, in that order; shares a uniquely-foldered daily file; then removes everything it made', async () => {
    await generateAndShareBook('<html/>', '2026-10-04', valid);
    expect(mockShare).toHaveBeenCalledTimes(1);
    const [sharedUri, options] = mockShare.mock.calls[0];
    expect(sharedUri).toMatch(/^cache\/memory-book-[^/]+\/OYNO-Memory-Book-2026-10-04\.pdf$/);
    expect(options).toMatchObject({ mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    const order = mockFs.log.map((line) => line.split(' ')[0]);
    expect(order.slice(0, 3)).toEqual(['mkdir', 'print', 'copy']);
    expect(mockIsAvailable.mock.invocationCallOrder[0]).toBeLessThan(mockShare.mock.invocationCallOrder[0]);
    expect(leftovers()).toEqual({ files: [], dirs: [] });
  });

  it('sharing unavailable: never shares, still cleans up', async () => {
    mockIsAvailable.mockResolvedValue(false);
    await expect(generateAndShareBook('<html/>', '2026-10-04', valid)).rejects.toBeInstanceOf(SharingUnavailableError);
    expect(mockShare).not.toHaveBeenCalled();
    expect(leftovers()).toEqual({ files: [], dirs: [] });
  });

  it('printing failure: never shares; the export folder is removed', async () => {
    mockPrintToFile.mockRejectedValueOnce(new Error('render failed'));
    await expect(generateAndShareBook('<html/>', '2026-10-04', valid)).rejects.toThrow('render failed');
    expect(mockShare).not.toHaveBeenCalled();
    expect(leftovers()).toEqual({ files: [], dirs: [] });
  });

  it('copy failure: the printed PDF was registered the moment it existed and is deleted; never shares', async () => {
    mockFs.failCopy = true;
    await expect(generateAndShareBook('<html/>', '2026-10-04', valid)).rejects.toThrow('disk full');
    expect(mockShare).not.toHaveBeenCalled();
    const printed = mockFs.log.find((line) => line.startsWith('print '))!.slice('print '.length);
    expect(mockFs.log).toContain(`rm ${printed}`);
    expect(leftovers()).toEqual({ files: [], dirs: [] });
  });

  it('sharing rejects: the error surfaces and cleanup still runs afterwards', async () => {
    mockShare.mockRejectedValueOnce(new Error('share failed'));
    await expect(generateAndShareBook('<html/>', '2026-10-04', valid)).rejects.toThrow('share failed');
    expect(leftovers()).toEqual({ files: [], dirs: [] });
  });

  it('cleanup happens only after the share sheet resolves', async () => {
    const sheet = deferred();
    mockShare.mockImplementationOnce(() => sheet.promise);
    const running = generateAndShareBook('<html/>', '2026-10-04', valid);
    await act(async () => undefined);
    expect(mockShare).toHaveBeenCalled();
    expect(leftovers().files.length).toBeGreaterThan(0);
    sheet.resolve();
    await running;
    expect(leftovers()).toEqual({ files: [], dirs: [] });
  });

  it.each([
    ['before printing', 0],
    ['after printing', 1],
    ['after copying', 2],
    ['immediately before the share sheet', 3],
  ])('session invalid %s: ExportCancelledError, no share, nothing left behind', async (_label, validChecks) => {
    let checks = 0;
    const session: ExportSession = { isValid: () => checks++ < validChecks };
    await expect(generateAndShareBook('<html/>', '2026-10-04', session)).rejects.toBeInstanceOf(ExportCancelledError);
    expect(mockShare).not.toHaveBeenCalled();
    expect(leftovers()).toEqual({ files: [], dirs: [] });
  });

  it('two overlapping exports (same daily name) never overwrite or delete each other\'s files', async () => {
    const firstPrint = deferred();
    const secondPrint = deferred();
    mockPrintGates.push(firstPrint, secondPrint);
    const secondSheet = deferred();
    // Share call #1 comes from the SECOND export and stays open; #2 (first export) closes at once.
    mockShare.mockImplementationOnce(() => secondSheet.promise).mockImplementationOnce(async () => undefined);
    const first = generateAndShareBook('<html>1</html>', '2026-10-04', valid);
    const second = generateAndShareBook('<html>2</html>', '2026-10-04', valid);

    secondPrint.resolve();
    await act(async () => undefined);
    expect(mockShare).toHaveBeenCalledTimes(1);
    const secondUri = mockShare.mock.calls[0][0];

    firstPrint.resolve();
    await first;
    const firstUri = mockShare.mock.calls[1][0];
    // Same file NAME, different folders: neither overwrote the other...
    expect(firstUri).not.toBe(secondUri);
    expect(firstUri.split('/').pop()).toBe(secondUri.split('/').pop());
    // ...and the first export's cleanup left the second's open PDF alone.
    expect(mockFs.files.has(secondUri)).toBe(true);
    expect(mockFs.files.has(firstUri)).toBe(false);

    secondSheet.resolve();
    await second;
    expect(leftovers()).toEqual({ files: [], dirs: [] });
  });
});

describe('exportMemoryBook - session safety', () => {
  const entries = [entry('a'), entry('b'), entry('c')];

  it('normal export: shared once, analytics recorded with counts only', async () => {
    await expect(runExport(entries)).resolves.toEqual({ status: 'shared', missingPhotos: 0 });
    expect(mockShare).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('journal_memory_book_created', { entry_count: 3, layout: 'classic', included_text: true });
  });

  it('guest export works (guest session)', async () => {
    signOut();
    await expect(runExport(entries)).resolves.toMatchObject({ status: 'shared' });
  });

  it('account A -> B during PDF generation: sharing is never called, no success event, temp PDFs removed', async () => {
    const gate = deferred();
    mockPrintGates.push(gate);
    const running = runExport(entries);
    await act(async () => undefined);
    signIn('user-b');
    gate.resolve();
    await expect(running).resolves.toEqual({ status: 'cancelled' });
    expect(mockShare).not.toHaveBeenCalled();
    expect(mockTrack).not.toHaveBeenCalled();
    expect(leftovers()).toEqual({ files: [], dirs: [] });
  });

  it('A signs out and back into A during generation: the old export is cancelled (same user id, new session)', async () => {
    const gate = deferred();
    mockPrintGates.push(gate);
    const running = runExport(entries);
    await act(async () => undefined);
    signOut();
    signIn('user-a');
    gate.resolve();
    await expect(running).resolves.toEqual({ status: 'cancelled' });
    expect(mockShare).not.toHaveBeenCalled();
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('a failure is reported as failed (not cancelled) and records no success', async () => {
    mockPrintToFile.mockRejectedValueOnce(new Error('render failed'));
    await expect(runExport(entries)).resolves.toEqual({ status: 'failed' });
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('session change during a photo download: no printing, and the stale download is removed from the old owner\'s folder', async () => {
    const download = deferred<string | null>();
    mockDownload.mockImplementationOnce(() => download.promise);
    const withRemote = [entry('a', { photo: { localUri: null, remotePath: 'user-a/a/v1.jpg', versionId: 'v1' } }), entry('b'), entry('c')];
    const running = runExport(withRemote);
    await act(async () => undefined);
    signOut();
    download.resolve('documents/journal/user-a/a-v1.jpg');
    await expect(running).resolves.toEqual({ status: 'cancelled' });
    expect(mockDeleteLocal).toHaveBeenCalledWith('documents/journal/user-a/a-v1.jpg', 'user-a');
    expect(mockPrintToFile).not.toHaveBeenCalled();
  });

  it('a missing photo is skipped and counted; the book is still shared', async () => {
    mockDownload.mockResolvedValueOnce(null);
    const withRemote = [entry('a', { photo: { localUri: null, remotePath: 'user-a/a/v1.jpg', versionId: 'v1' } }), entry('b'), entry('c')];
    await expect(runExport(withRemote)).resolves.toEqual({ status: 'shared', missingPhotos: 1 });
  });

  it('a local photo is inlined as image data (never a path)', async () => {
    mockFs.files.set('documents/journal/user-a/a-v1.jpg', 'JPEGDATA');
    let html = '';
    await exportMemoryBook({
      entries: [entry('a', { photo: { localUri: 'documents/journal/user-a/a-v1.jpg', remotePath: null, versionId: 'v1' } }), entry('b'), entry('c')],
      includeText: false,
      layout: 'photo',
      formatDate: (date) => date,
      buildHtml: (pages) => {
        html = JSON.stringify(pages);
        return '<html/>';
      },
      today: '2026-10-04',
    });
    expect(html).toContain(`data:image/jpeg;base64,${Buffer.from('JPEGDATA').toString('base64')}`);
    expect(html).not.toContain('documents/journal');
    expect(html).not.toContain('"note":"note"');
  });
});

describe('Review step (content review before export)', () => {
  const photoEntry = (id: string, date: string, extra: Partial<JournalEntry> = {}) => entry(id, { date, note: `private note ${id}`, ...extra });
  const local = (id: string) => ({ localUri: `documents/journal/user-a/${id}.jpg`, remotePath: `user-a/${id}/v1.jpg`, versionId: 'v1' });
  const remoteOnly = (id: string) => ({ localUri: null, remotePath: `user-a/${id}/v1.jpg`, versionId: 'v1' });
  const exists = (uri: string) => mockFs.files.has(uri);

  it('review order is exactly the export order', async () => {
    const list = [photoEntry('c', '2026-03-01'), photoEntry('a', '2026-01-01'), photoEntry('b', '2026-02-01')];
    const review = reviewItems(list, ['a', 'b', 'c'], 'newest', true, exists, true);
    expect(review.map((item) => item.id)).toEqual(['c', 'b', 'a']);
    const prepared = await prepareMemoryBook({ entries: list.filter(() => true).sort((x, y) => y.date.localeCompare(x.date)), includeText: true, layout: 'classic', formatDate: (d) => d });
    expect(prepared.status === 'ready' && prepared.book.pages.map((page) => page.title)).toEqual(review.map((item) => `Memory ${item.id}`));
  });

  it('text OFF: no note content anywhere in the review', () => {
    const list = [photoEntry('a', '2026-01-01'), photoEntry('b', '2026-02-01'), photoEntry('c', '2026-03-01')];
    const review = reviewItems(list, ['a', 'b', 'c'], 'oldest', false, exists, true);
    expect(review.every((item) => item.notePreview === null)).toBe(true);
    expect(JSON.stringify(review)).not.toContain('private note');
    expect(reviewItems(list, ['a', 'b', 'c'], 'oldest', true, exists, true)[0].notePreview).toBe('private note a');
  });

  it('distinguishes a local photo, an account copy (tried, not promised) and a missing one - without fetching', () => {
    mockFs.files.set('documents/journal/user-a/a.jpg', 'JPEG');
    expect(reviewPhotoState({ photo: local('a') }, exists, true)).toBe('local');
    expect(reviewPhotoState({ photo: remoteOnly('b') }, exists, true)).toBe('account');
    expect(reviewPhotoState({ photo: remoteOnly('b') }, exists, false)).toBe('missing');
    expect(reviewPhotoState({ photo: { localUri: 'gone.jpg', remotePath: null, versionId: null } }, exists, true)).toBe('missing');
    expect(reviewPhotoState({ photo: null }, exists, true)).toBe('none');
    expect(mockDownload).not.toHaveBeenCalled();
    const [item] = reviewItems([photoEntry('a', '2026-01-01', { photo: local('a') })], ['a'], 'oldest', false, exists, true);
    expect(item.thumbnailUri).toBe('documents/journal/user-a/a.jpg');
  });

  it('missing photos are known BEFORE sharing (nothing printed or shared during preparation)', async () => {
    mockDownload.mockResolvedValue(null);
    const prepared = await prepareMemoryBook({ entries: [photoEntry('a', '2026-01-01', { photo: remoteOnly('a') }), photoEntry('b', '2026-02-01'), photoEntry('c', '2026-03-01')], includeText: false, layout: 'classic', formatDate: (d) => d });
    expect(prepared).toMatchObject({ status: 'ready', book: { missingPhotoIds: ['a'] } });
    expect(mockPrintToFile).not.toHaveBeenCalled();
    expect(mockShare).not.toHaveBeenCalled();
  });

  it('"try again" reuses prepared photos and only retries the missing ones', async () => {
    mockFs.files.set('documents/journal/user-a/ok.jpg', 'JPEG');
    mockDownload.mockResolvedValueOnce('documents/journal/user-a/ok.jpg').mockResolvedValueOnce(null);
    const list = [photoEntry('ok', '2026-01-01', { photo: remoteOnly('ok') }), photoEntry('later', '2026-02-01', { photo: remoteOnly('later') }), photoEntry('c', '2026-03-01')];
    const cache = createPhotoCache();
    const first = await prepareMemoryBook({ entries: list, includeText: false, layout: 'classic', formatDate: (d) => d, cache });
    expect(first.status === 'ready' && first.book.missingPhotoIds).toEqual(['later']);
    expect(mockDownload).toHaveBeenCalledTimes(2);
    // Second attempt (connection back): only "later" is fetched again.
    mockFs.files.set('documents/journal/user-a/later.jpg', 'JPEG');
    mockDownload.mockResolvedValueOnce('documents/journal/user-a/later.jpg');
    const second = await prepareMemoryBook({ entries: list, includeText: false, layout: 'classic', formatDate: (d) => d, cache });
    expect(second.status === 'ready' && second.book.missingPhotoIds).toEqual([]);
    expect(mockDownload).toHaveBeenCalledTimes(3);
    expect(mockDownload.mock.calls[2][1]).toBe('later');
  });

  it('continuing without the missing photos shares the prepared book (no second download)', async () => {
    mockDownload.mockResolvedValue(null);
    const prepared = await prepareMemoryBook({ entries: [photoEntry('a', '2026-01-01', { photo: remoteOnly('a') }), photoEntry('b', '2026-02-01'), photoEntry('c', '2026-03-01')], includeText: false, layout: 'classic', formatDate: (d) => d });
    if (prepared.status !== 'ready') throw new Error('not ready');
    const calls = mockDownload.mock.calls.length;
    await expect(shareMemoryBook(prepared.book, () => '<html/>', '2026-10-04')).resolves.toEqual({ status: 'shared', missingPhotos: 1 });
    expect(mockDownload.mock.calls.length).toBe(calls);
  });

  it('an account change invalidates prepared private content and the photo cache', async () => {
    mockFs.files.set('documents/journal/user-a/a.jpg', 'JPEG');
    const cache = createPhotoCache();
    const prepared = await prepareMemoryBook({ entries: [photoEntry('a', '2026-01-01', { photo: local('a') }), photoEntry('b', '2026-02-01'), photoEntry('c', '2026-03-01')], includeText: true, layout: 'photo', formatDate: (d) => d, cache });
    if (prepared.status !== 'ready') throw new Error('not ready');
    expect(cache.images.size).toBe(1);
    signIn('user-b');
    expect(photoCacheValid(cache)).toBe(false);
    // The old prepared book can't be shared in the new session.
    await expect(shareMemoryBook(prepared.book, () => '<html/>', '2026-10-04')).resolves.toEqual({ status: 'cancelled' });
    expect(mockShare).not.toHaveBeenCalled();
    // A stale cache is never used by a new preparation.
    mockFs.files.delete('documents/journal/user-a/a.jpg');
    const fresh = await prepareMemoryBook({ entries: [photoEntry('a', '2026-01-01', { photo: { localUri: 'documents/journal/user-a/a.jpg', remotePath: null, versionId: 'v1' } }), photoEntry('b', '2026-02-01'), photoEntry('c', '2026-03-01')], includeText: false, layout: 'classic', formatDate: (d) => d, cache });
    expect(fresh.status === 'ready' && fresh.book.missingPhotoIds).toEqual(['a']);
  });

  it('review copy exists in KG/RU/EN and calls itself a content check, not a page preview', () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const locales = [require('@/i18n/locales/kg.json'), require('@/i18n/locales/ru.json'), require('@/i18n/locales/en.json')];
    /* eslint-enable @typescript-eslint/no-require-imports */
    for (const locale of locales) {
      for (const key of ['review', 'reviewTitle', 'reviewNote', 'backToSelection', 'missingMessage', 'continueWithout', 'tryAgain']) expect(locale.memoryBook[key]).toBeTruthy();
      for (const state of ['local', 'account', 'missing', 'none']) expect(locale.memoryBook.photoState[state]).toBeTruthy();
    }
    expect(locales[2].memoryBook.reviewNote).toMatch(/not a preview of the pages/);
  });
});
