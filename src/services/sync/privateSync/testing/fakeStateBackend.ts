/**
 * TESTS ONLY - an in-memory stand-in for public.user_state_records and
 * push_user_state() that mirrors 20261002000001_private_state_sync.sql:
 * rows are per user, writes are compare-and-swap on `rev`, deletions are
 * tombstones, a conflict returns the stored row. Never imported by the app.
 */
type Row = { domain: string; record_key: string; rev: number; deleted: boolean; payload: unknown };

export type FakeStateBackend = {
  rows: Map<string, Map<string, Row>>;
  /** true = server error; 'missing' = migration not applied (PGRST205). */
  fail: boolean | 'missing';
  pushes: number;
  /** PostgREST-like query: .select().order().order().range() */
  query: (userId: string) => unknown;
  push: (userId: string, domain: string, items: { key: string; base_rev: number; deleted: boolean; payload: unknown }[]) => { data: unknown; error: unknown };
};

export function createFakeStateBackend(): FakeStateBackend {
  const backend: FakeStateBackend = {
    rows: new Map(),
    fail: false,
    pushes: 0,
    query(userId) {
      const response = () => {
        if (backend.fail === 'missing') return { data: null, error: { code: 'PGRST205', message: 'relation user_state_records does not exist' } };
        if (backend.fail) return { data: null, error: { code: '08006', message: 'connection failure' } };
        const all = [...(backend.rows.get(userId)?.values() ?? [])].sort((a, b) => a.domain.localeCompare(b.domain) || a.record_key.localeCompare(b.record_key));
        return { data: all.map((row) => ({ ...row, payload: row.payload === null ? null : JSON.parse(JSON.stringify(row.payload)) })), error: null };
      };
      const chain = {
        select: () => chain,
        order: () => chain,
        range: (from: number, to: number) => {
          const result = response();
          return Promise.resolve(result.error ? result : { data: (result.data as Row[]).slice(from, to + 1), error: null });
        },
      };
      return chain;
    },
    push(userId, domain, items) {
      backend.pushes += 1;
      if (backend.fail === 'missing') return { data: null, error: { code: 'PGRST202', message: 'missing' } };
      if (backend.fail) return { data: null, error: { code: '08006', message: 'connection failure' } };
      if (!backend.rows.has(userId)) backend.rows.set(userId, new Map());
      const table = backend.rows.get(userId)!;
      const accepted: unknown[] = [];
      const conflicts: unknown[] = [];
      for (const item of items) {
        const id = `${domain}\u0000${item.key}`;
        const existing = table.get(id);
        const out = (row: Row) => ({ key: row.record_key, rev: row.rev, deleted: row.deleted, payload: row.payload === null ? null : JSON.parse(JSON.stringify(row.payload)) });
        if (!existing) {
          if (item.deleted) {
            accepted.push({ key: item.key, rev: 0, deleted: true, payload: null });
            continue;
          }
          const row: Row = { domain, record_key: item.key, rev: 1, deleted: false, payload: JSON.parse(JSON.stringify(item.payload)) };
          table.set(id, row);
          accepted.push(out(row));
        } else if (existing.rev !== item.base_rev) {
          conflicts.push(out(existing));
        } else {
          const row: Row = { ...existing, rev: existing.rev + 1, deleted: item.deleted, payload: item.deleted ? null : JSON.parse(JSON.stringify(item.payload)) };
          table.set(id, row);
          accepted.push(out(row));
        }
      }
      return { data: { accepted, conflicts }, error: null };
    },
  };
  return backend;
}
