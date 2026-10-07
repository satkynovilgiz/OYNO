/**
 * Web feedback images. On web the picker hands us a `blob:` URL - valid
 * only while this page is open, and not something a queued report can be
 * stored with. So the moment a report is queued, the image's BYTES are
 * copied into the browser's IndexedDB under the report's id, and the
 * queue keeps only an internal reference:
 *
 *   oyno-attachment:<client report id>
 *
 * That reference is the only non-file image a queued report may carry -
 * never a blob:, data: or remote URL read back from storage. If IndexedDB
 * isn't available (private mode, blocked storage), the bytes are kept in
 * memory for this page only and the sheet says so; after a reload such a
 * report is sent without its image (marked `screenshot: not_uploaded`).
 */
export const WEB_ATTACHMENT_PREFIX = 'oyno-attachment:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AttachmentDurability = 'durable' | 'session';

export type AttachmentStore = {
  put: (id: string, bytes: ArrayBuffer) => Promise<boolean>;
  get: (id: string) => Promise<ArrayBuffer | null>;
  remove: (id: string) => Promise<void>;
};

export function webAttachmentUri(reportId: string): string {
  return `${WEB_ATTACHMENT_PREFIX}${reportId}`;
}

/** The report id of an internal reference, or null if it isn't exactly one. */
export function webAttachmentId(uri: unknown): string | null {
  if (typeof uri !== 'string' || !uri.startsWith(WEB_ATTACHMENT_PREFIX)) return null;
  const id = uri.slice(WEB_ATTACHMENT_PREFIX.length);
  return UUID.test(id) ? id : null;
}

/** A picked web image, just selected in this page - the only time blob:/data: is accepted. */
export function isFreshWebImageSource(uri: string): boolean {
  return uri.startsWith('blob:') || /^data:image\/jpe?g[;,]/i.test(uri);
}

/** A real JPEG starts with FF D8 FF - the name or MIME type alone is not trusted. */
export function isJpegBytes(bytes: ArrayBuffer): boolean {
  const head = new Uint8Array(bytes, 0, Math.min(3, bytes.byteLength));
  return head.length === 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
}

// ---------------------------------------------------------------------

const memory = new Map<string, ArrayBuffer>();
const memoryStore: AttachmentStore = {
  put: async (id, bytes) => {
    memory.set(id, bytes);
    return true;
  },
  get: async (id) => memory.get(id) ?? null,
  remove: async (id) => {
    memory.delete(id);
  },
};

const DB_NAME = 'oyno-feedback';
const STORE = 'attachments';

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const factory = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
      if (!factory) return resolve(null);
      const request = factory.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const transaction = db.transaction(STORE, mode);
          const request = action(transaction.objectStore(STORE));
          transaction.oncomplete = () => {
            db.close();
            resolve((request.result as T) ?? null);
          };
          transaction.onerror = transaction.onabort = () => {
            db.close();
            resolve(null);
          };
        } catch {
          db.close();
          resolve(null);
        }
      }),
  );
}

const indexedDbStore: AttachmentStore = {
  put: async (id, bytes) => (await run<IDBValidKey>('readwrite', (store) => store.put(bytes, id))) !== null,
  get: async (id) => {
    const value = await run<unknown>('readonly', (store) => store.get(id));
    return value instanceof ArrayBuffer ? value : null;
  },
  remove: async (id) => {
    await run('readwrite', (store) => store.delete(id));
  },
};

let durableStore: AttachmentStore = indexedDbStore;

/** Tests only: replace the durable (IndexedDB) store; null = none available. */
export function __setDurableAttachmentStoreForTests(store: AttachmentStore | null): void {
  durableStore = store ?? { put: async () => false, get: async () => null, remove: async () => {} };
  memory.clear();
}

/** Copies a freshly picked web image into attachment storage. null = it can't be kept (not a JPEG, too big, unreadable). */
export async function keepWebAttachment(sourceUri: string, reportId: string, maxBytes: number): Promise<{ uri: string; durability: AttachmentDurability } | null> {
  if (!isFreshWebImageSource(sourceUri) || !UUID.test(reportId)) return null;
  let bytes: ArrayBuffer;
  try {
    bytes = await (await fetch(sourceUri)).arrayBuffer();
  } catch {
    return null;
  }
  if (bytes.byteLength === 0 || bytes.byteLength > maxBytes || !isJpegBytes(bytes)) return null;
  if (await durableStore.put(reportId, bytes).catch(() => false)) return { uri: webAttachmentUri(reportId), durability: 'durable' };
  await memoryStore.put(reportId, bytes);
  return { uri: webAttachmentUri(reportId), durability: 'session' };
}

export async function readWebAttachment(uri: string): Promise<ArrayBuffer | null> {
  const id = webAttachmentId(uri);
  if (!id) return null;
  return (await memoryStore.get(id)) ?? (await durableStore.get(id).catch(() => null));
}

export async function removeWebAttachment(uri: string | null): Promise<void> {
  const id = webAttachmentId(uri);
  if (!id) return;
  await memoryStore.remove(id);
  await durableStore.remove(id).catch(() => undefined);
}
