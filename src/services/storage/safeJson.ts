/**
 * Every store/service that reads AsyncStorage/SecureStore does
 * `JSON.parse(raw)` on whatever comes back. A single corrupted value (an
 * interrupted write, a bad migration, manual tampering) used to throw
 * synchronously inside an async `load()`, which - because the app's boot
 * sequence awaits several `load()` calls with `Promise.all` and no
 * `.catch` - left the whole app stuck on the splash screen forever with no
 * error shown. This makes that failure mode impossible: a corrupted value
 * for one key falls back to `fallback` instead of taking down boot.
 */
export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
