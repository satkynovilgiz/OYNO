import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { supabase } from '@/services/supabase/client';

/**
 * Journal photos are FILES, never JSON: the store keeps only a file path.
 *   on device  -> <app documents>/journal/<entry id>-<time>.jpg
 *   in account -> private bucket "journal-photos", "<user id>/<entry id>.jpg"
 *                 (only that user can read or write it; shown via short-lived
 *                 signed URLs or downloaded back into the documents folder).
 * On web there's no durable file storage, so photos are a phone feature.
 */
const BUCKET = 'journal-photos';

export function journalPhotosSupported(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    return !!requireOptionalNativeModule('FileSystem');
  } catch {
    return false;
  }
}

function fileSystem(): typeof import('expo-file-system') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-file-system') as typeof import('expo-file-system');
}

function journalFolder() {
  const { Directory, Paths } = fileSystem();
  const folder = new Directory(Paths.document, 'journal');
  if (!folder.exists) folder.create();
  return folder;
}

/** Copies a picked image into the app's own storage. */
export async function keepLocalPhoto(sourceUri: string, entryId: string): Promise<string | null> {
  if (!journalPhotosSupported()) return null;
  try {
    const { File } = fileSystem();
    const target = new File(journalFolder(), `${entryId}-${Date.now()}.jpg`);
    await new File(sourceUri).copy(target);
    return target.uri;
  } catch {
    return null;
  }
}

export function deleteLocalPhoto(uri: string | null | undefined): void {
  if (!uri || !journalPhotosSupported() || !uri.includes('/journal/')) return;
  try {
    const { File } = fileSystem();
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone.
  }
}

/** Sign-out: remove every journal photo file of the previous account. */
export function deleteAllLocalPhotos(): void {
  if (!journalPhotosSupported()) return;
  try {
    const { Directory, Paths } = fileSystem();
    const folder = new Directory(Paths.document, 'journal');
    if (folder.exists) folder.delete();
  } catch {
    // Nothing stored.
  }
}

export function remotePhotoPath(userId: string, entryId: string): string {
  return `${userId}/${entryId}.jpg`;
}

export async function uploadPhoto(userId: string, entryId: string, localUri: string): Promise<string> {
  const path = remotePhotoPath(userId, entryId);
  const bytes = await (await fetch(localUri)).arrayBuffer();
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

/** Brings an account photo back onto a (new) device. */
export async function downloadPhoto(remotePath: string, entryId: string): Promise<string | null> {
  if (!journalPhotosSupported()) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(remotePath, 300);
  if (error || !data?.signedUrl) return null;
  try {
    const { File } = fileSystem();
    const file = await File.downloadFileAsync(data.signedUrl, new File(journalFolder(), `${entryId}-${Date.now()}.jpg`));
    return file.uri;
  } catch {
    return null;
  }
}

export async function deleteRemotePhoto(remotePath: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([remotePath]);
}
