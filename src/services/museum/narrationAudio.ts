import { Platform } from 'react-native';

/**
 * Where Mini Museum narrations live: ON THIS DEVICE, bound to the owner
 * who recorded them. Never uploaded, not synced, not in the learning-data
 * export.
 *
 * - Web: IndexedDB (`oyno-narrations`), one record per recording with its owner.
 * - Native: files under <documents>/narrations/<owner>/<id>.<ext>.
 *
 * Every read checks the owner: another account asking for an id gets null,
 * even if it somehow knows the id. The recorder's TEMPORARY file is only
 * copied in on `save` (after the curator confirms) and is never kept.
 */
export type NarrationAudioStore = {
  /** Copies a confirmed temporary recording in; resolves to the new id (rejects on failure - nothing is half-saved). */
  save: (owner: string, tempUri: string) => Promise<string>;
  /** A playable URI for this owner's recording, or null (missing / another owner). */
  uri: (owner: string, id: string) => Promise<string | null>;
  remove: (owner: string, id: string) => Promise<void>;
  /** This owner's recording ids. */
  list: (owner: string) => Promise<string[]>;
  /** Guest -> signed-in account: the guest's recordings follow their exhibitions. */
  reassign: (from: string, to: string) => Promise<void>;
};

const newId = () => `n${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const safeOwner = (owner: string) => owner.replace(/[^A-Za-z0-9-]/g, '_').slice(0, 64) || '_';

/* ---------- memory (tests) ---------- */

export function memoryNarrationStore(read: (tempUri: string) => Promise<unknown> = async (uri) => uri): NarrationAudioStore & { records: Map<string, { owner: string; data: unknown }> } {
  const records = new Map<string, { owner: string; data: unknown }>();
  return {
    records,
    save: async (owner, tempUri) => {
      const data = await read(tempUri);
      const id = newId();
      records.set(id, { owner, data });
      return id;
    },
    uri: async (owner, id) => (records.get(id)?.owner === owner ? `memory:${id}` : null),
    remove: async (owner, id) => {
      if (records.get(id)?.owner === owner) records.delete(id);
    },
    list: async (owner) => [...records.entries()].filter(([, record]) => record.owner === owner).map(([id]) => id),
    reassign: async (from, to) => {
      for (const record of records.values()) if (record.owner === from) record.owner = to;
    },
  };
}

/* ---------- web: IndexedDB ---------- */

const DB = 'oyno-narrations';
const STORE = 'recordings';
type WebRecord = { id: string; owner: string; blob: Blob };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    transaction.oncomplete = () => {
      db.close();
      resolve(request ? request.result : undefined);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}
const all = async () => ((await tx<WebRecord[]>('readonly', (store) => store.getAll() as IDBRequest<WebRecord[]>)) ?? []);
/** Object URLs handed out for playback, revoked when replaced or removed. */
const webUrls = new Map<string, string>();

export const webNarrationStore: NarrationAudioStore = {
  save: async (owner, tempUri) => {
    const blob = await (await fetch(tempUri)).blob();
    if (!blob.size) throw new Error('empty recording');
    const id = newId();
    await tx('readwrite', (store) => store.put({ id, owner, blob } satisfies WebRecord));
    return id;
  },
  uri: async (owner, id) => {
    const record = await tx<WebRecord | undefined>('readonly', (store) => store.get(id) as IDBRequest<WebRecord | undefined>);
    if (!record || record.owner !== owner) return null;
    const previous = webUrls.get(id);
    if (previous) URL.revokeObjectURL(previous);
    const url = URL.createObjectURL(record.blob);
    webUrls.set(id, url);
    return url;
  },
  remove: async (owner, id) => {
    const record = await tx<WebRecord | undefined>('readonly', (store) => store.get(id) as IDBRequest<WebRecord | undefined>);
    if (!record || record.owner !== owner) return;
    await tx('readwrite', (store) => store.delete(id));
    const url = webUrls.get(id);
    if (url) URL.revokeObjectURL(url);
    webUrls.delete(id);
  },
  list: async (owner) => (await all()).filter((record) => record.owner === owner).map((record) => record.id),
  reassign: async (from, to) => {
    const mine = (await all()).filter((record) => record.owner === from);
    if (mine.length) await tx('readwrite', (store) => void mine.forEach((record) => store.put({ ...record, owner: to })));
  },
};

/* ---------- native: document directory ---------- */

function nativeFs() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-file-system') as typeof import('expo-file-system');
}
function ownerDir(owner: string) {
  const { Directory, Paths } = nativeFs();
  const dir = new Directory(Paths.document, 'narrations', safeOwner(owner));
  return dir;
}
const NATIVE_ID = /^(n[a-z0-9]+-[a-z0-9]+)\.[a-z0-9]+$/;

export const nativeNarrationStore: NarrationAudioStore = {
  save: async (owner, tempUri) => {
    const { File } = nativeFs();
    const source = new File(tempUri);
    if (!source.exists) throw new Error('missing recording');
    const dir = ownerDir(owner);
    if (!dir.exists) dir.create({ intermediates: true });
    const id = newId();
    const target = new File(dir, `${id}.${source.extension.replace('.', '') || 'm4a'}`);
    await source.copy(target);
    if (!target.exists) throw new Error('copy failed');
    return id;
  },
  uri: async (owner, id) => {
    const dir = ownerDir(owner);
    if (!dir.exists) return null;
    const file = dir.list().find((entry) => NATIVE_ID.exec(entry.name)?.[1] === id);
    return file ? file.uri : null;
  },
  remove: async (owner, id) => {
    const dir = ownerDir(owner);
    if (!dir.exists) return;
    for (const entry of dir.list()) if (NATIVE_ID.exec(entry.name)?.[1] === id) entry.delete();
  },
  list: async (owner) => {
    const dir = ownerDir(owner);
    if (!dir.exists) return [];
    return dir.list().flatMap((entry) => NATIVE_ID.exec(entry.name)?.[1] ?? []);
  },
  reassign: async (from, to) => {
    const source = ownerDir(from);
    if (!source.exists) return;
    const target = ownerDir(to);
    if (!target.exists) target.create({ intermediates: true });
    for (const entry of source.list()) await entry.move(target);
  },
};

let active: NarrationAudioStore | null = null;
export function narrationAudio(): NarrationAudioStore {
  if (!active) active = Platform.OS === 'web' ? webNarrationStore : nativeNarrationStore;
  return active;
}
/** Tests: swap the backend. */
export function setNarrationAudioStore(store: NarrationAudioStore | null): void {
  active = store;
}

/** Deletes recordings this owner no longer references (a removed exhibit, a deleted collection, a failed delete). */
export async function sweepNarrations(owner: string, referenced: ReadonlySet<string>): Promise<string[]> {
  const store = narrationAudio();
  const ids = await store.list(owner).catch(() => [] as string[]);
  const orphans = ids.filter((id) => !referenced.has(id));
  for (const id of orphans) await store.remove(owner, id).catch(() => undefined);
  return orphans;
}
