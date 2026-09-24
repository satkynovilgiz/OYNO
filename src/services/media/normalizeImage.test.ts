/**
 * Image normalization with a fake decoder/encoder standing in for
 * expo-image-manipulator (a native module) and the in-memory
 * expo-file-system mock for real files.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';

import { registerSyncScheduler } from '@/services/sync/syncTrigger';
import { useJournalStore } from '@/store/useJournalStore';

import { FEEDBACK_IMAGE, ImageNormalizationError, JOURNAL_IMAGE, normalizeToJpeg, targetSize } from './normalizeImage';

type Source = { width: number; height: number; format: 'jpeg' | 'png' | 'heic' | 'corrupt' };

const mockCodec = {
  available: true,
  sources: new Map<string, Source>(),
  /** bytes of an encoded JPEG for (width, height, quality) */
  sizeOf: (width: number, height: number, quality: number) => Math.round(width * height * quality * 0.3),
  resizes: [] as { width?: number; height?: number }[],
  encodes: [] as { format: string; compress: number }[],
  saved: [] as string[],
};

jest.mock('expo', () => {
  const actual = jest.requireActual('expo');
  return {
    ...actual,
    requireOptionalNativeModule: (name: string) => (name === 'ExpoImageManipulator' ? (mockCodec.available ? {} : null) : actual.requireOptionalNativeModule(name)),
  };
});

jest.mock('expo-image-manipulator', () => {
  const { File: MockFile, Paths: MockPaths } = jest.requireActual('expo-file-system');
  let saved = 0;
  function ref(width: number, height: number) {
    return {
      width,
      height,
      saveAsync: async ({ format, compress }: { format: string; compress: number }) => {
        mockCodec.encodes.push({ format, compress });
        saved += 1;
        const file = new MockFile(MockPaths.cache, `ImageManipulator-${saved}.jpg`);
        file.create();
        // A real JPEG header + a body sized like the encoder would produce.
        const bytes = new Uint8Array(Math.max(4, mockCodec.sizeOf(width, height, compress)));
        bytes.set([0xff, 0xd8, 0xff, 0xe0]);
        file.write(bytes);
        mockCodec.saved.push(file.uri);
        return { uri: file.uri, width, height };
      },
    };
  }
  function context(width: number, height: number) {
    let target = { width, height };
    const ctx = {
      resize: (size: { width?: number; height?: number }) => {
        mockCodec.resizes.push(size);
        target = size.width ? { width: size.width, height: Math.round((height * size.width) / width) } : { width: Math.round((width * size.height!) / height), height: size.height! };
        return ctx;
      },
      renderAsync: async () => ref(target.width, target.height),
    };
    return ctx;
  }
  return {
    SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
    ImageManipulator: {
      manipulate: (source: string | { width: number; height: number }) => {
        if (typeof source !== 'string') return context(source.width, source.height);
        const info = mockCodec.sources.get(source);
        if (!info || info.format === 'corrupt') return { resize: () => { throw new Error('decode'); }, renderAsync: async () => { throw new Error('cannot decode'); } };
        return context(info.width, info.height);
      },
    },
  };
});

jest.mock('@/services/supabase/client', () => ({ supabase: { rpc: jest.fn(), from: jest.fn(), storage: { from: jest.fn() } } }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: { getState: () => ({ status: 'authenticated', user: { id: 'user-a' } }) }, registerAccountHooks: jest.fn() }));

let counter = 0;
function sourceFile(extension: string, info: Source): string {
  counter += 1;
  const file = new File(Paths.cache, `ImagePicker-${counter}.${extension}`);
  file.create();
  file.write(`original-${extension}`);
  mockCodec.sources.set(file.uri, info);
  return file.uri;
}

function isJpegFile(uri: string): boolean {
  const bytes = new File(uri).bytesSync();
  return bytes[0] === 0xff && bytes[1] === 0xd8;
}

beforeEach(async () => {
  mockCodec.available = true;
  mockCodec.sources.clear();
  mockCodec.resizes = [];
  mockCodec.encodes = [];
  mockCodec.saved = [];
  mockCodec.sizeOf = (width, height, quality) => Math.round(width * height * quality * 0.3);
  await AsyncStorage.clear();
  registerSyncScheduler(null, () => 'user-a');
  useJournalStore.setState({ entries: [], isLoaded: true });
});

describe('normalizeToJpeg', () => {
  it('JPEG input: re-encoded as JPEG, long edge capped at 2048, never upscaled', async () => {
    const uri = sourceFile('jpg', { width: 4032, height: 3024, format: 'jpeg' });
    const result = await normalizeToJpeg({ uri, mimeType: 'image/jpeg' }, JOURNAL_IMAGE);
    expect(result).toMatchObject({ width: 2048, height: 1536, mimeType: 'image/jpeg' });
    expect(result.uri).toMatch(/\.jpg$/);
    expect(isJpegFile(result.uri)).toBe(true);
    expect(mockCodec.encodes[0]).toEqual({ format: 'jpeg', compress: 0.88 });

    const small = sourceFile('jpg', { width: 800, height: 600, format: 'jpeg' });
    mockCodec.resizes = [];
    const smallResult = await normalizeToJpeg({ uri: small, mimeType: 'image/jpeg' }, JOURNAL_IMAGE);
    expect(mockCodec.resizes).toEqual([]);
    expect(smallResult).toMatchObject({ width: 800, height: 600 });
  });

  it('PNG input becomes an actual JPEG (decoded + re-encoded, not renamed)', async () => {
    const uri = sourceFile('png', { width: 1200, height: 900, format: 'png' });
    const result = await normalizeToJpeg({ uri, mimeType: 'image/png' }, JOURNAL_IMAGE);
    expect(result.uri).not.toBe(uri);
    expect(isJpegFile(result.uri)).toBe(true);
    expect(new File(uri).textSync()).toBe('original-png'); // source untouched
    expect(mockCodec.encodes.map((encode) => encode.format)).toEqual(['jpeg']);
  });

  it('HEIC input goes through the same decode -> JPEG path (portrait edge capped)', async () => {
    const uri = sourceFile('heic', { width: 3024, height: 4032, format: 'heic' });
    const result = await normalizeToJpeg({ uri, mimeType: 'image/heic' }, JOURNAL_IMAGE);
    expect(mockCodec.resizes).toEqual([{ height: 2048 }]);
    expect(result).toMatchObject({ width: 1536, height: 2048, mimeType: 'image/jpeg' });
    expect(isJpegFile(result.uri)).toBe(true);
  });

  it('shrinks further when the first JPEG is over the limit, and removes the rejected attempt', async () => {
    const uri = sourceFile('jpg', { width: 4000, height: 3000, format: 'jpeg' });
    mockCodec.sizeOf = (width) => (width > 1300 ? 5 * 1024 * 1024 : 1024 * 1024);
    const result = await normalizeToJpeg({ uri, mimeType: 'image/jpeg' }, FEEDBACK_IMAGE);
    expect(result.width).toBeLessThanOrEqual(1200);
    expect(result.byteSize!).toBeLessThanOrEqual(FEEDBACK_IMAGE.maxBytes);
    // Earlier, too-big attempts were deleted; only the returned file remains.
    expect(mockCodec.saved.length).toBeGreaterThan(1);
    expect(mockCodec.saved.filter((uri) => new File(uri).exists)).toEqual([result.uri]);
  });

  it('an image that can never fit fails with too_large (caller falls back to no image)', async () => {
    const uri = sourceFile('jpg', { width: 4000, height: 3000, format: 'jpeg' });
    mockCodec.sizeOf = () => 50 * 1024 * 1024;
    await expect(normalizeToJpeg({ uri, mimeType: 'image/jpeg' }, FEEDBACK_IMAGE)).rejects.toMatchObject({ code: 'too_large' });
    expect(mockCodec.saved.filter((saved) => new File(saved).exists)).toEqual([]);
  });

  it('an undecodable file fails with decode_failed', async () => {
    const uri = sourceFile('heic', { width: 1, height: 1, format: 'corrupt' });
    await expect(normalizeToJpeg({ uri, mimeType: 'image/heic' }, JOURNAL_IMAGE)).rejects.toBeInstanceOf(ImageNormalizationError);
  });

  it('without the native module, only a genuine JPEG is accepted - PNG/HEIC are never renamed', async () => {
    mockCodec.available = false;
    const png = sourceFile('png', { width: 100, height: 100, format: 'png' });
    await expect(normalizeToJpeg({ uri: png, mimeType: 'image/png' }, JOURNAL_IMAGE)).rejects.toMatchObject({ code: 'unavailable' });
    const heic = sourceFile('heic', { width: 100, height: 100, format: 'heic' });
    await expect(normalizeToJpeg({ uri: heic }, JOURNAL_IMAGE)).rejects.toMatchObject({ code: 'unavailable' });
    const jpeg = sourceFile('jpg', { width: 100, height: 100, format: 'jpeg' });
    await expect(normalizeToJpeg({ uri: jpeg, mimeType: 'image/jpeg' }, JOURNAL_IMAGE)).resolves.toMatchObject({ uri: jpeg, mimeType: 'image/jpeg' });
  });

  it('never upscales', () => {
    expect(targetSize(1000, 800, 2048)).toBeNull();
    expect(targetSize(4000, 1000, 2048)).toEqual({ width: 2048 });
  });
});

describe('journal photos after normalization', () => {
  const baseDraft = { title: 'Lake', note: '', date: '2026-09-20', link: null };

  it('each new photo gets a new versionId, lands in the account folder, and the temp file is removed', async () => {
    const first = await normalizeToJpeg({ uri: sourceFile('heic', { width: 3000, height: 2000, format: 'heic' }) }, JOURNAL_IMAGE);
    const entry = (await useJournalStore.getState().create({ ...baseDraft, photoUri: first.uri }))!;
    expect(entry.photo!.localUri).toMatch(new RegExp(`/journal/user-a/${entry.id}-${entry.photo!.versionId}\\.jpg$`));
    expect(new File(first.uri).exists).toBe(false); // temp cleaned
    expect(new File(entry.photo!.localUri!).exists).toBe(true);

    const second = await normalizeToJpeg({ uri: sourceFile('png', { width: 1000, height: 1000, format: 'png' }) }, JOURNAL_IMAGE);
    const updated = (await useJournalStore.getState().update(entry.id, { ...baseDraft, photoUri: second.uri }))!;
    expect(updated.photo!.versionId).not.toBe(entry.photo!.versionId);
    expect(updated.photo!.remotePath).toBeNull(); // uploaded as a NEW immutable version on sync
    expect(updated.photo!.localUri).toMatch(/\/journal\/user-a\//);
  });

  it("a photo that can't be stored leaves the existing photo and its file untouched", async () => {
    const first = await normalizeToJpeg({ uri: sourceFile('jpg', { width: 800, height: 600, format: 'jpeg' }), mimeType: 'image/jpeg' }, JOURNAL_IMAGE);
    const entry = (await useJournalStore.getState().create({ ...baseDraft, photoUri: first.uri }))!;
    const updated = (await useJournalStore.getState().update(entry.id, { ...baseDraft, photoUri: 'file:///mock/cache/gone.jpg' }))!;
    expect(updated.photo).toEqual(entry.photo);
    expect(new File(entry.photo!.localUri!).exists).toBe(true);
  });
});
