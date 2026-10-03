/**
 * Private Cloud Sync - the pure three-way reconcile used by every private
 * domain (Reading, Highlights, My Collections, ...).
 *
 * Every domain is a set of small records (`key -> payload`). For each key
 * we know three versions:
 *
 *   base   - what this device last saw on the server (the "ledger"), with
 *            the server revision it had
 *   local  - what the device holds now
 *   server - what the account holds now (revision + payload, or deleted)
 *
 * From those, without timestamps guessing who "wins":
 *   - only local changed  -> push local (compare-and-swap on the revision)
 *   - only server changed -> take the server's version
 *   - both changed        -> the domain's explicit merge rule (never
 *                            "server always wins")
 *   - neither             -> nothing
 *
 * A deletion is a change like any other: it travels as a tombstone, so a
 * device that never touched the record removes it too and can't bring it
 * back later. A device that EDITED the record while it was being deleted
 * elsewhere keeps the edit (no silent data loss) - see each domain's rule.
 */

export type RecordPayload = unknown;

export type ServerRecord = { rev: number; deleted: boolean; payload: RecordPayload | null };

/** What this device last saw on the server for a key. */
export type LedgerEntry = { rev: number; base: RecordPayload | null };

export type DomainRules<P> = {
  /**
   * false = a key missing locally was evicted by a cap (history lists),
   * not deleted by the person - it is never sent as a deletion.
   */
  deletes: boolean;
  /** Untrusted server JSON -> a payload, or null when unusable. */
  validate: (raw: unknown) => P | null;
  /** Grow-only domains: what the device holds is read together with its
   * base, so a locally capped list never shrinks the account's copy. */
  normalizeLocal?: (base: P, local: P) => P;
  /** Both sides changed since `base` (null when there was no shared base). */
  merge: (base: P | null, local: P, server: P, key: string) => P;
};

export type PushItem = { key: string; baseRev: number; payload: RecordPayload | null };

export type ReconcileResult<P> = {
  /** The local records after taking server changes and merges. */
  local: Record<string, P>;
  /** Writes for the server (compare-and-swap against `baseRev`). */
  push: PushItem[];
  /** Ledger after this pass (pushed keys are updated once accepted). */
  ledger: Record<string, LedgerEntry>;
  conflicts: number;
};

/** Stable JSON: object keys sorted, so equal data always compares equal. */
export function canonical(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`);
  return `{${entries.join(',')}}`;
}

export function samePayload(a: unknown, b: unknown): boolean {
  return canonical(a ?? null) === canonical(b ?? null);
}

export function reconcile<P>(
  rules: DomainRules<P>,
  localRecords: Record<string, P>,
  serverRecords: Record<string, ServerRecord>,
  ledger: Record<string, LedgerEntry>,
): ReconcileResult<P> {
  const local: Record<string, P> = { ...localRecords };
  const nextLedger: Record<string, LedgerEntry> = { ...ledger };
  const push: PushItem[] = [];
  let conflicts = 0;

  const keys = new Set([...Object.keys(localRecords), ...Object.keys(serverRecords), ...Object.keys(ledger)]);
  for (const key of [...keys].sort()) {
    const server = serverRecords[key];
    const serverRev = server?.rev ?? 0;
    const serverValue = server && !server.deleted ? rules.validate(server.payload) : null;
    const known = ledger[key];
    const baseRev = known?.rev ?? 0;
    const base = known ? (known.base === null ? null : rules.validate(known.base)) : null;
    const held = Object.prototype.hasOwnProperty.call(localRecords, key) ? localRecords[key] : null;
    const mine = held !== null && base !== null && rules.normalizeLocal ? rules.normalizeLocal(base, held) : held;

    const evicted = mine === null && !rules.deletes && !!known;
    const localChanged = !evicted && !samePayload(mine, base);
    const serverChanged = serverRev !== baseRev;

    const adoptServer = () => {
      if (serverValue === null) delete local[key];
      else local[key] = serverValue;
      if (serverRev === 0) delete nextLedger[key];
      else nextLedger[key] = { rev: serverRev, base: serverValue };
    };

    if (!localChanged && !serverChanged) continue;

    if (!localChanged) {
      // Evicted-by-cap keys only come back when the server version is new.
      adoptServer();
      continue;
    }

    if (!serverChanged) {
      if (mine === null && serverRev === 0) {
        delete nextLedger[key];
        continue;
      }
      push.push({ key, baseRev: serverRev, payload: mine });
      continue;
    }

    // Both changed.
    if (samePayload(mine, serverValue)) {
      adoptServer();
      continue;
    }
    conflicts += 1;
    let merged: P | null;
    if (mine !== null && serverValue !== null) merged = rules.merge(base, mine, serverValue, key);
    else merged = mine ?? serverValue; // an edit wins over a deletion it never saw
    if (merged === null) delete local[key];
    else local[key] = merged;
    if (samePayload(merged, serverValue)) nextLedger[key] = { rev: serverRev, base: serverValue };
    else push.push({ key, baseRev: serverRev, payload: merged });
  }

  return { local, push, ledger: nextLedger, conflicts };
}

/**
 * Applies the server's answer to a push: accepted keys move the ledger to
 * the new revision; rejected keys (the server moved on meanwhile) stay as
 * they were and are reconciled again against a fresh read.
 */
export function applyPushResult(
  ledger: Record<string, LedgerEntry>,
  accepted: readonly { key: string; rev: number; deleted: boolean; payload: RecordPayload | null }[],
): Record<string, LedgerEntry> {
  const next = { ...ledger };
  for (const row of accepted) next[row.key] = { rev: row.rev, base: row.deleted ? null : row.payload };
  return next;
}

/**
 * Local edits made WHILE a sync was on the network win over its result:
 * a key whose current value differs from the snapshot the sync started
 * from keeps the current value (it is pushed next time).
 */
export function preserveConcurrentEdits<P>(snapshot: Record<string, P>, current: Record<string, P>, reconciled: Record<string, P>): Record<string, P> {
  const result: Record<string, P> = { ...reconciled };
  const keys = new Set([...Object.keys(snapshot), ...Object.keys(current)]);
  for (const key of keys) {
    const before = Object.prototype.hasOwnProperty.call(snapshot, key) ? snapshot[key] : null;
    const now = Object.prototype.hasOwnProperty.call(current, key) ? current[key] : null;
    if (samePayload(before, now)) continue;
    if (now === null) delete result[key];
    else result[key] = now;
  }
  return result;
}

/** Counter merged from two devices that both started at `base`. */
export function mergeCounter(base: number | undefined, local: number, server: number): number {
  return server + Math.max(0, local - (base ?? 0));
}
