import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { supabase } from '@/services/supabase/client';

/**
 * Journal photos are FILES, never JSON: the store keeps only paths.
 *
 * On device - one folder PER OWNER, so clearing one account can never touch
 * another account's (or the guest's) private images:
 *   <app documents>/journal/guest/<entry id>-<version id>.jpg
 *   <app documents>/journal/<user id>/<entry id>-<version id>.jpg
 *
 * In the account - IMMUTABLE versioned objects in the private bucket:
 *   journal-photos/<user id>/<entry id>/<version id>.jpg
 * A journal record references the exact version it owns, so an older device
 * uploading later writes a different object and can never replace the photo
 * of a newer entry version. Records written before versioning keep their
 * legacy path "<user id>/<entry id>.jpg" and still load (read-only).
 * On web there's no durable file storage, so photos are a phone feature.
 */
const BUCKET = 'journal-photos';
/** The bucket's own limit (20260923000003_journal.sql). */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ROOT = 'journal';
export const GUEST_PHOTO_OWNER = 'guest';

const OWNER_RE = /^[A-Za-z0-9-]{1,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only a plain id ('guest' or an auth user id) can name a folder - never a path. */
export function sanitizeOwner(owner: string | null | undefined): string | null {
  if (!owner) return null;
  return OWNER_RE.test(owner) ? owner : null;
}

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

function ownerFolder(owner: string, create: boolean) {
  const safe = sanitizeOwner(owner);
  if (!safe) return null;
  const { Directory, Paths } = fileSystem();
  const root = new Directory(Paths.document, ROOT);
  if (create && !root.exists) root.create();
  const folder = new Directory(root, safe);
  if (create && !folder.exists) folder.create();
  return folder;
}

/** True only when `uri` is a file directly inside this owner's folder. */
export function isInOwnerFolder(uri: string | null | undefined, owner: string): boolean {
  if (!uri || !journalPhotosSupported()) return false;
  const folder = ownerFolder(owner, false);
  if (!folder) return false;
  const prefix = folder.uri.endsWith('/') ? folder.uri : `${folder.uri}/`;
  return uri.startsWith(prefix) && !uri.slice(prefix.length).includes('/') && !uri.includes('..');
}

function localName(entryId: string, versionId: string): string {
  return `${entryId.replace(/[^A-Za-z0-9-]/g, '')}-${versionId.replace(/[^A-Za-z0-9-]/g, '')}.jpg`;
}

/** Copies a picked image into the owner's own folder. */
export async function keepLocalPhoto(sourceUri: string, entryId: string, owner: string, versionId: string): Promise<string | null> {
  if (!journalPhotosSupported()) return null;
  try {
    const folder = ownerFolder(owner, true);
    if (!folder) return null;
    const { File } = fileSystem();
    const target = new File(folder, localName(entryId, versionId));
    if (!target.exists) await new File(sourceUri).copy(target);
    return target.uri;
  } catch {
    return null;
  }
}

/** Deletes a photo file - only if it lives in THIS owner's folder. */
export function deleteLocalPhoto(uri: string | null | undefined, owner: string): void {
  if (!isInOwnerFolder(uri, owner)) return;
  try {
    const { File } = fileSystem();
    const file = new File(uri!);
    if (file.exists) file.delete();
  } catch {
    // Already gone.
  }
}

/** Removes one owner's photo folder - never the shared root or another owner's. */
export function deleteAllLocalPhotos(owner: string): void {
  if (!journalPhotosSupported()) return;
  try {
    const folder = ownerFolder(owner, false);
    if (folder?.exists) folder.delete();
  } catch {
    // Nothing stored.
  }
}

/**
 * Moves a photo into `toOwner`'s folder (guest -> account on sign-in, or a
 * pre-versioning file from the shared root). Returns the new uri, or the
 * original one if it couldn't be moved - an image is never lost.
 */
export async function adoptLocalPhoto(uri: string, entryId: string, versionId: string, toOwner: string): Promise<string> {
  if (!journalPhotosSupported() || isInOwnerFolder(uri, toOwner)) return uri;
  const moved = await keepLocalPhoto(uri, entryId, toOwner, versionId);
  if (!moved) return uri;
  try {
    const { File } = fileSystem();
    const old = new File(uri);
    // Only files inside the journal area are ever removed.
    if (old.exists && uri.includes(`/${ROOT}/`)) old.delete();
  } catch {
    // Copy succeeded; leaving the old file is harmless.
  }
  return moved;
}

// ---------------------------------------------------------------------
// Cloud (versioned, immutable)
// ---------------------------------------------------------------------

export function versionedPhotoPath(userId: string, entryId: string, versionId: string): string {
  return `${userId}/${entryId}/${versionId}.jpg`;
}

/** Pre-versioning records: "<user id>/<entry id>.jpg" - read-only now. */
export function isLegacyPhotoPath(path: string): boolean {
  return /^[A-Za-z0-9-]+\/[0-9a-f-]{36}\.jpg$/i.test(path);
}

/** Upload once; the object is never replaced. A retry of an interrupted
 * upload finds the same version already there and treats that as success. */
export async function uploadPhotoVersion(userId: string, entryId: string, versionId: string, localUri: string): Promise<string> {
  if (!UUID_RE.test(versionId)) throw new Error('INVALID_VERSION');
  const path = versionedPhotoPath(userId, entryId, versionId);
  const bytes = await (await fetch(localUri)).arrayBuffer();
  // Normalized photos are well under this; never attempt a doomed upload.
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new Error('PHOTO_TOO_LARGE');
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (error && !/exists|duplicate/i.test(error.message)) throw error;
  return path;
}

/** Brings an account photo (versioned or legacy) back onto a device. */
export async function downloadPhoto(remotePath: string, entryId: string, owner: string, versionId: string): Promise<string | null> {
  if (!journalPhotosSupported()) return null;
  const folder = ownerFolder(owner, true);
  if (!folder) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(remotePath, 300);
  if (error || !data?.signedUrl) return null;
  try {
    const { File } = fileSystem();
    const target = new File(folder, localName(entryId, versionId));
    if (target.exists) return target.uri;
    const file = await File.downloadFileAsync(data.signedUrl, target);
    return file.uri;
  } catch {
    return null;
  }
}

export type StoredPhotoObject = { name: string; createdAt: string | null };

/** How long a just-uploaded version is protected: another device may have
 * uploaded it and not yet saved the record that references it. */
export const PHOTO_CLEANUP_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Conservative clean-up choice for one entry's version folder: delete only
 * versions that are (a) not the version the account's record references
 * and (b) old enough that no other device can still be about to reference
 * them. Unknown upload times are never deleted.
 */
export function staleVersionsToDelete(objects: StoredPhotoObject[], referencedPath: string | null, folderPath: string, now: number, graceMs = PHOTO_CLEANUP_GRACE_MS): string[] {
  return objects
    .filter((object) => /^[0-9a-f-]{36}\.jpg$/i.test(object.name))
    .map((object) => ({ path: `${folderPath}/${object.name}`, created: object.createdAt ? Date.parse(object.createdAt) : NaN }))
    .filter(({ path, created }) => path !== referencedPath && Number.isFinite(created) && now - created > graceMs)
    .map(({ path }) => path);
}

/** Deletes superseded versions of one entry (see `staleVersionsToDelete`). */
export async function cleanupStaleVersions(userId: string, entryId: string, referencedPath: string | null): Promise<number> {
  const folderPath = `${userId}/${entryId}`;
  const { data, error } = await supabase.storage.from(BUCKET).list(folderPath, { limit: 100 });
  if (error || !data) return 0;
  const stale = staleVersionsToDelete(
    data.map((object) => ({ name: object.name, createdAt: (object as { created_at?: string | null }).created_at ?? null })),
    referencedPath,
    folderPath,
    Date.now(),
  );
  if (stale.length === 0) return 0;
  const { error: removeError } = await supabase.storage.from(BUCKET).remove(stale);
  return removeError ? 0 : stale.length;
}
