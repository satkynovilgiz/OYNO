import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/**
 * Turns an image the user picked (HEIC, PNG or JPEG - the file name is not
 * trusted) into a REAL JPEG before OYNO stores or uploads it:
 *
 *   decode -> shrink so the long edge is at most `maxLongEdge` (never
 *   upscale) -> encode a fresh JPEG at `quality`
 *
 * Re-encoding from decoded pixels writes a new file, so the source's EXIF
 * block (GPS position, camera/device details) is not carried over.
 * If the result is still over `maxBytes`, it's re-encoded smaller (up to
 * two more steps); if that still can't fit, it fails with 'too_large'.
 *
 * Needs expo-image-manipulator (a native module). Builds made before it was
 * added don't have it: then only a picker result that is ALREADY a JPEG is
 * accepted (the iOS picker converts HEIC itself in "compatible" mode - see
 * `pickerOptionsForJpeg`), and anything else fails honestly with
 * 'unavailable' instead of being renamed to .jpg.
 */

export type ImageProfile = { maxLongEdge: number; quality: number; maxBytes: number };

/** Private journal photos: bucket limit 8 MB, kept visually sharp. */
export const JOURNAL_IMAGE: ImageProfile = { maxLongEdge: 2048, quality: 0.88, maxBytes: 7.5 * 1024 * 1024 };
/** Beta feedback images: bucket limit 3 MB; a readable screenshot is enough. */
export const FEEDBACK_IMAGE: ImageProfile = { maxLongEdge: 1600, quality: 0.8, maxBytes: 2.8 * 1024 * 1024 };

export type NormalizedImage = { uri: string; width: number; height: number; byteSize: number | null; mimeType: 'image/jpeg' };

export type NormalizeFailure = 'unavailable' | 'decode_failed' | 'too_large';

export class ImageNormalizationError extends Error {
  constructor(public readonly code: NormalizeFailure) {
    super(code);
    this.name = 'ImageNormalizationError';
  }
}

export type PickedImage = { uri: string; width?: number; height?: number; mimeType?: string | null; fileSize?: number | null };

export function manipulatorAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    return !!requireOptionalNativeModule('ExpoImageManipulator');
  } catch {
    return false;
  }
}

/** Picker options that give the best chance of a JPEG on every build. */
export function pickerOptionsForJpeg() {
  return {
    mediaTypes: ['images'] as ['images'],
    // Full quality when we re-encode ourselves; otherwise let the picker
    // produce the JPEG (iOS: HEIC -> JPEG in "compatible" mode).
    quality: manipulatorAvailable() ? 1 : 0.88,
    exif: false,
    preferredAssetRepresentationMode: 'compatible' as never,
  };
}

/** Target size for a long-edge limit; null = already small enough (no upscaling). */
export function targetSize(width: number, height: number, maxLongEdge: number): { width: number } | { height: number } | null {
  if (!width || !height || Math.max(width, height) <= maxLongEdge) return null;
  return width >= height ? { width: maxLongEdge } : { height: maxLongEdge };
}

function fileSize(uri: string): number | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { File } = require('expo-file-system') as typeof import('expo-file-system');
    const file = new File(uri);
    return file.exists ? file.size : null;
  } catch {
    return null;
  }
}

function isJpeg(picked: PickedImage): boolean {
  const mime = (picked.mimeType ?? '').toLowerCase();
  if (mime) return mime === 'image/jpeg' || mime === 'image/jpg';
  return /\.jpe?g$/i.test(picked.uri.split('?')[0]);
}

/**
 * Deletes a temporary image we produced or received (cache folder only) -
 * never a persisted file in the app's documents folder.
 */
export function deleteTempImage(uri: string | null | undefined): void {
  if (!uri || Platform.OS === 'web') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
    const cacheUri = Paths.cache.uri.endsWith('/') ? Paths.cache.uri : `${Paths.cache.uri}/`;
    if (!uri.startsWith(cacheUri) || uri.includes('..')) return;
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Temp storage is cleared by the OS anyway.
  }
}

const SHRINK_STEPS = [
  { edge: 1, quality: 0 },
  { edge: 0.75, quality: -0.1 },
  { edge: 0.5, quality: -0.2 },
];

export async function normalizeToJpeg(picked: PickedImage, profile: ImageProfile): Promise<NormalizedImage> {
  if (!manipulatorAvailable()) {
    // Older build: accept only a genuine JPEG from the picker, never rename.
    if (!isJpeg(picked)) throw new ImageNormalizationError('unavailable');
    const size = picked.fileSize ?? fileSize(picked.uri);
    if (size !== null && size > profile.maxBytes) throw new ImageNormalizationError('too_large');
    return { uri: picked.uri, width: picked.width ?? 0, height: picked.height ?? 0, byteSize: size, mimeType: 'image/jpeg' };
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ImageManipulator, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
  let decoded;
  try {
    decoded = await ImageManipulator.manipulate(picked.uri).renderAsync();
  } catch {
    throw new ImageNormalizationError('decode_failed');
  }

  let previousAttempt: string | null = null;
  for (const step of SHRINK_STEPS) {
    const edge = Math.round(profile.maxLongEdge * step.edge);
    const quality = Math.max(0.5, profile.quality + step.quality);
    const size = targetSize(decoded.width, decoded.height, edge);
    try {
      const image = size ? await ImageManipulator.manipulate(decoded).resize(size).renderAsync() : decoded;
      const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality });
      deleteTempImage(previousAttempt);
      previousAttempt = saved.uri;
      const byteSize = fileSize(saved.uri);
      if (byteSize === null || byteSize <= profile.maxBytes) {
        return { uri: saved.uri, width: saved.width, height: saved.height, byteSize, mimeType: 'image/jpeg' };
      }
    } catch {
      deleteTempImage(previousAttempt);
      throw new ImageNormalizationError('decode_failed');
    }
  }
  deleteTempImage(previousAttempt);
  throw new ImageNormalizationError('too_large');
}
