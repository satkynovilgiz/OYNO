import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { deleteLocalPhoto, downloadPhoto, journalPhotosSupported } from '@/services/journal/journalPhotos';

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

/**
 * Whether the account session that STARTED an export is still the active
 * one. Built by the caller from the account-generation token (see
 * services/sync/accountGeneration.ts), so it also fails for "signed out and
 * back into the same account" - not only for a different user id.
 */
export type ExportSession = { isValid: () => boolean };

/** The session changed mid-export: a deliberate stop, not a failure. */
export class ExportCancelledError extends Error {
  constructor() {
    super('EXPORT_CANCELLED');
    this.name = 'ExportCancelledError';
  }
}

export class SharingUnavailableError extends Error {
  constructor() {
    super('SHARING_UNAVAILABLE');
    this.name = 'SharingUnavailableError';
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
 *
 * Session safety: nothing is downloaded once the export's session is
 * stale. A download that finishes AFTER the session changed is removed
 * again when its owner is no longer the person on this device (otherwise
 * a signed-out account's private photo would reappear in its cleared
 * folder). `isOwnerCurrent` answers "is `owner` still this device's
 * Journal owner?".
 */
export async function photoDataUri(entry: JournalEntry, owner: string, signedIn: boolean, session: ExportSession, isOwnerCurrent: (owner: string) => boolean): Promise<string | null> {
  const photo = entry.photo;
  if (!photo || !session.isValid()) return null;
  try {
    const { File } = fileSystem();
    let uri = photo.localUri && new File(photo.localUri).exists ? photo.localUri : null;
    if (!uri && signedIn && photo.remotePath) {
      uri = await downloadPhoto(photo.remotePath, entry.id, owner, photo.versionId ?? 'legacy');
      if (uri && !session.isValid()) {
        if (!isOwnerCurrent(owner)) deleteLocalPhoto(uri, owner);
        return null;
      }
    }
    if (!uri || !session.isValid()) return null;
    const base64 = await new File(uri).base64();
    return base64 && session.isValid() ? `data:image/jpeg;base64,${base64}` : null;
  } catch {
    return null;
  }
}

/** Whether a local file exists right now (review only - no download, no network). */
export function localFileExists(uri: string): boolean {
  try {
    const { File } = fileSystem();
    return new File(uri).exists;
  } catch {
    return false;
  }
}

let exportCounter = 0;

/** A cache folder no other export uses - concurrent exports never share files. */
export function uniqueExportFolderName(now: number = Date.now()): string {
  exportCounter += 1;
  return `memory-book-${now.toString(36)}-${exportCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

type Deletable = { exists: boolean; delete: () => void };

/**
 * HTML -> temporary PDF -> share sheet -> delete.
 *
 * Every file this export creates is registered for cleanup the moment it
 * exists and removed in `finally` - after sharing resolves, rejects, or the
 * export stops early. Each export works in its OWN cache folder, so two
 * overlapping exports (same daily file name) can neither overwrite nor
 * delete each other's PDF. Never uploaded.
 *
 * The session is re-checked before printing, after printing, after the
 * copy and IMMEDIATELY before the share sheet opens; a stale session
 * throws ExportCancelledError and nothing is shared.
 *
 * Limit: once the system share sheet is open the file has been handed to
 * the OS; if the user then picks another app, OYNO cannot take that copy
 * back. The checks above guarantee only that a stale session never OPENS
 * the sheet.
 */
export async function generateAndShareBook(html: string, today: string, session: ExportSession): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Print = require('expo-print') as typeof import('expo-print');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sharing = require('expo-sharing') as typeof import('expo-sharing');
  const { Directory, File, Paths } = fileSystem();
  const temps: Deletable[] = [];
  const ensureValid = () => {
    if (!session.isValid()) throw new ExportCancelledError();
  };
  try {
    ensureValid();
    const folder = new Directory(Paths.cache, uniqueExportFolderName());
    folder.create({ intermediates: true, idempotent: true });
    temps.push(folder);

    const printed = await Print.printToFileAsync({ html, width: A4.width, height: A4.height });
    const printedFile = new File(printed.uri);
    temps.push(printedFile);
    ensureValid();

    const named = new File(folder, bookFileName(today));
    await printedFile.copy(named);
    temps.push(named);
    ensureValid();

    if (!(await Sharing.isAvailableAsync())) throw new SharingUnavailableError();
    // Last moment before the file leaves the app.
    ensureValid();
    await Sharing.shareAsync(named.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: bookFileName(today) });
  } finally {
    // Files first, then this export's own folder (recursive).
    cleanupTemps([...temps].reverse());
  }
}

export function cleanupTemps(files: readonly Deletable[]): void {
  for (const file of files) {
    try {
      if (file.exists) file.delete();
    } catch {
      // Best effort: the OS also clears the cache directory.
    }
  }
}
