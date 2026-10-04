import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { downloadPhoto, journalPhotosSupported } from '@/services/journal/journalPhotos';

import type { JournalEntry } from '../journalModel';
import { A4, bookFileName } from './memoryBookModel';

/**
 * Native-only PDF generation (expo-print renders HTML -> PDF on the
 * device). On web expo-print only opens the browser print dialog, and a
 * build without the native module can't print at all - both report
 * "unsupported" instead of pretending.
 */
export function memoryBookSupported(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    return !!requireOptionalNativeModule('ExpoPrint') && journalPhotosSupported();
  } catch {
    return false;
  }
}

function fileSystem(): typeof import('expo-file-system') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-file-system') as typeof import('expo-file-system');
}

/**
 * The entry's photo as inline image data (iOS can't load local file URLs
 * while printing HTML). Uses the existing Journal photo architecture: this
 * device's copy, else the signed-in account's version brought down by
 * downloadPhoto. Any failure -> null: that memory is printed without it.
 */
export async function photoDataUri(entry: JournalEntry, owner: string, signedIn: boolean): Promise<string | null> {
  const photo = entry.photo;
  if (!photo) return null;
  try {
    const { File } = fileSystem();
    let uri = photo.localUri && new File(photo.localUri).exists ? photo.localUri : null;
    if (!uri && signedIn && photo.remotePath) uri = await downloadPhoto(photo.remotePath, entry.id, owner, photo.versionId ?? 'legacy');
    if (!uri) return null;
    const base64 = await new File(uri).base64();
    return base64 ? `data:image/jpeg;base64,${base64}` : null;
  } catch {
    return null;
  }
}

/**
 * HTML -> temporary PDF -> share sheet -> delete. Both the printer's output
 * and the renamed copy live in the cache and are removed afterwards
 * (whether sharing succeeded, was cancelled or failed). Never uploaded.
 */
export async function generateAndShareBook(html: string, today: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Print = require('expo-print') as typeof import('expo-print');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sharing = require('expo-sharing') as typeof import('expo-sharing');
  const { File, Paths } = fileSystem();
  const temps: InstanceType<typeof File>[] = [];
  try {
    const printed = await Print.printToFileAsync({ html, width: A4.width, height: A4.height });
    const source = new File(printed.uri);
    temps.push(source);
    const named = new File(Paths.cache, bookFileName(today));
    if (named.exists) named.delete();
    source.copy(named);
    temps.push(named);
    if (!(await Sharing.isAvailableAsync())) throw new Error('SHARING_UNAVAILABLE');
    await Sharing.shareAsync(named.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: bookFileName(today) });
  } finally {
    cleanupTemps(temps);
  }
}

export function cleanupTemps(files: readonly { exists: boolean; delete: () => void }[]): void {
  for (const file of files) {
    try {
      if (file.exists) file.delete();
    } catch {
      // Best effort: the OS also clears the cache directory.
    }
  }
}
