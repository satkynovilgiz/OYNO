import type { BrowserContext, Page, Route } from '@playwright/test';

import { FIXTURE_TABLES } from './data';

/** The web build is exported with this fake Supabase URL (npm run e2e:build). */
export const FAKE_SUPABASE = 'https://oyno-e2e.test';

export type LoggedRequest = { method: string; path: string; status: number };
/** A request the registry does not allow - fails the test (see helpers.ts). */
export type UnexpectedRequest = { kind: 'backend' | 'external' | 'websocket'; method: string; url: string; reason: string };
export type BackendLog = { requests: LoggedRequest[]; unexpected: UnexpectedRequest[] };

// ---------------------------------------------------------------------
// Registry: EVERYTHING the guest journeys may ask the backend. Anything
// else - unknown table, unknown RPC, a write, unsupported query syntax - is
// answered with an error (so the screen shows its error state instead of
// hanging) AND recorded as unexpected, which fails the test.
// ---------------------------------------------------------------------

/** Public read-only tables served from fixtures/data.ts. */
export const READ_TABLES = new Set(Object.keys(FIXTURE_TABLES));

/** Writes that are allowed and DISCARDED (nothing is stored). */
export const DISCARDED_WRITES: Record<string, readonly string[]> = {
  // Product analytics (src/services/analytics/analytics.ts) - fire-and-forget inserts.
  analytics_events: ['POST'],
};

/** RPCs the guest journeys call, with their deterministic results. None today. */
export const RPCS: Record<string, unknown> = {};

/**
 * Columns of the tables that have NO fixture rows (the journeys only need
 * them to be empty). Tables with rows take their columns from the rows.
 * Mirrors the queries in src/services/content/*.
 */
export const EMPTY_TABLE_COLUMNS: Record<string, readonly string[]> = {
  culture_materials: ['id', 'sort_order'],
  content_translations: ['content_type', 'content_id', 'language', 'field', 'value'],
  explore_regions: ['id', 'sort_order'],
  discoveries: ['id', 'published', 'sort_order'],
  region_content_links: ['region_id', 'content_type', 'content_id', 'sort_order', 'updated_at'],
  quests: ['id'],
  quest_steps: ['id', 'quest_id', 'step_order'],
};

/** Auth endpoints a signed-out (guest) client may call. */
const AUTH_GET: Record<string, unknown> = {
  '/auth/v1/settings': { external: { google: false, apple: false, email: true } },
};

/** PostgREST filter operators implemented below. Others are unsupported. */
const OPERATORS = ['eq', 'neq', 'in', 'is', 'gt', 'gte', 'lt', 'lte'] as const;
const RESERVED = new Set(['select', 'order', 'limit', 'offset']);

type Row = Record<string, unknown>;
class Unsupported extends Error {}

function parseList(raw: string): string[] {
  if (!raw.startsWith('(') || !raw.endsWith(')')) throw new Unsupported(`malformed list "${raw}"`);
  return raw.slice(1, -1).split(',').map((value) => value.trim().replace(/^"|"$/g, ''));
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

/** Columns of a fixture table (union over its rows) - anything else is an unknown column. */
function columnsOf(table: string, rows: Row[]): Set<string> {
  return new Set([...rows.flatMap((row) => Object.keys(row)), ...(EMPTY_TABLE_COLUMNS[table] ?? [])]);
}

function applyFilter(rows: Row[], columns: Set<string>, column: string, raw: string): Row[] {
  if (raw.startsWith('not.')) throw new Unsupported(`negated filter "${column}=${raw}"`);
  const dot = raw.indexOf('.');
  const op = raw.slice(0, dot);
  const value = raw.slice(dot + 1);
  if (dot < 0 || !(OPERATORS as readonly string[]).includes(op)) throw new Unsupported(`operator in "${column}=${raw}" (supported: ${OPERATORS.join(', ')})`);
  // Checked against the whole table, not the rows left by earlier filters.
  if (!columns.has(column)) throw new Unsupported(`unknown column "${column}"`);
  switch (op) {
    case 'eq':
      return rows.filter((row) => String(row[column]) === value);
    case 'neq':
      return rows.filter((row) => String(row[column]) !== value);
    case 'in': {
      const values = parseList(value);
      return rows.filter((row) => values.includes(String(row[column])));
    }
    case 'is':
      if (value === 'null') return rows.filter((row) => row[column] === null || row[column] === undefined);
      if (value === 'true' || value === 'false') return rows.filter((row) => row[column] === (value === 'true'));
      throw new Unsupported(`is.${value}`);
    default: {
      const n = Number(value);
      const test = { gt: (c: number) => c > 0, gte: (c: number) => c >= 0, lt: (c: number) => c < 0, lte: (c: number) => c <= 0 }[op as 'gt'];
      return rows.filter((row) => test(compare(row[column], Number.isFinite(n) && typeof row[column] === 'number' ? n : value)));
    }
  }
}

function applyOrder(rows: Row[], columns: Set<string>, raw: string): Row[] {
  const terms = raw.split(',').map((term) => {
    const [column, ...modifiers] = term.split('.');
    if (!columns.has(column)) throw new Unsupported(`order by unknown column "${column}"`);
    for (const modifier of modifiers) if (!['asc', 'desc', 'nullsfirst', 'nullslast'].includes(modifier)) throw new Unsupported(`order modifier "${modifier}"`);
    return { column, desc: modifiers.includes('desc'), nullsFirst: modifiers.includes('nullsfirst') };
  });
  return [...rows].sort((a, b) => {
    for (const term of terms) {
      const av = a[term.column];
      const bv = b[term.column];
      const aNull = av === null || av === undefined;
      const bNull = bv === null || bv === undefined;
      if (aNull !== bNull) return (aNull ? 1 : -1) * (term.nullsFirst ? -1 : 1);
      const result = compare(av, bv) * (term.desc ? -1 : 1);
      if (result !== 0) return result;
    }
    return 0;
  });
}

function applySelect(rows: Row[], known: Set<string>, raw: string | null): Row[] {
  if (!raw || raw === '*') return rows;
  if (/[()!:]/.test(raw)) throw new Unsupported(`embedded/aliased select "${raw}"`);
  const columns = raw.split(',').map((column) => column.trim());
  // PostgREST rejects an unknown column; silently dropping it would hide a fixture gap.
  const missing = columns.filter((column) => !known.has(column));
  if (missing.length > 0) throw new Unsupported(`select of unknown column(s) ${missing.map((column) => `"${column}"`).join(', ')} - add them to the fixture rows`);
  return rows.map((row) => Object.fromEntries(columns.filter((column) => column in row).map((column) => [column, row[column]])));
}

/** Range via ?limit/&offset or the Range header ("0-9"). */
function applyRange(rows: Row[], params: URLSearchParams, rangeHeader: string | undefined): { rows: Row[]; from: number } {
  let from = Number(params.get('offset') ?? 0);
  let to = params.has('limit') ? from + Number(params.get('limit')) - 1 : Infinity;
  if (rangeHeader) {
    const match = /^(\d+)-(\d+)$/.exec(rangeHeader);
    if (!match) throw new Unsupported(`Range "${rangeHeader}"`);
    from = Number(match[1]);
    to = Math.min(to, Number(match[2]));
  }
  if (!Number.isInteger(from) || from < 0 || (to !== Infinity && !Number.isInteger(to))) throw new Unsupported('limit/offset');
  return { rows: rows.slice(from, to === Infinity ? undefined : to + 1), from };
}

export async function installBackend(page: Page): Promise<BackendLog> {
  const log: BackendLog = { requests: [], unexpected: [] };
  await page.route(`${FAKE_SUPABASE}/**`, async (route: Route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;
    const respond = async (status: number, body: unknown, headers: Record<string, string> = {}) => {
      log.requests.push({ method, path: path + url.search, status });
      await route.fulfill({ status, contentType: 'application/json', headers, body: body === undefined ? '' : JSON.stringify(body) });
    };
    const reject = async (reason: string) => {
      log.unexpected.push({ kind: 'backend', method, url: path + url.search, reason });
      return respond(400, { code: 'E2E_UNEXPECTED', message: `e2e fake backend: ${reason}` });
    };

    if (path.startsWith('/auth/v1/')) {
      if (method === 'GET' && path in AUTH_GET) return respond(200, AUTH_GET[path]);
      return reject(`auth endpoint ${method} ${path} is not registered (guest journeys never sign in)`);
    }
    if (path.startsWith('/rest/v1/rpc/')) {
      const name = path.slice('/rest/v1/rpc/'.length);
      if (name in RPCS) return respond(200, RPCS[name]);
      return reject(`RPC "${name}" is not registered - add it to RPCS in e2e/fixtures/backend.ts with a deterministic result`);
    }
    if (!path.startsWith('/rest/v1/')) return reject(`endpoint ${path} is not part of the fake backend (storage, realtime, functions are not served)`);

    const table = path.slice('/rest/v1/'.length);
    if (method !== 'GET' && method !== 'HEAD') {
      if (DISCARDED_WRITES[table]?.includes(method)) return respond(201, undefined);
      return reject(`write ${method} ${table} is not allowed - only ${Object.entries(DISCARDED_WRITES).map(([t, m]) => `${m.join('/')} ${t}`).join(', ')} (discarded)`);
    }
    if (!READ_TABLES.has(table)) return reject(`table "${table}" is not registered - add fixture rows to e2e/fixtures/data.ts`);

    try {
      const params = url.searchParams;
      let rows = FIXTURE_TABLES[table];
      const columns = columnsOf(table, rows);
      for (const [key, raw] of params.entries()) if (!RESERVED.has(key)) rows = applyFilter(rows, columns, key, raw);
      if (params.has('order')) rows = applyOrder(rows, columns, params.get('order')!);
      const total = rows.length;
      const headers = request.headers();
      const ranged = applyRange(rows, params, headers['range']);
      const selected = applySelect(ranged.rows, columns, params.get('select'));
      const contentRange = `${selected.length ? `${ranged.from}-${ranged.from + selected.length - 1}` : '*'}/${(headers['prefer'] ?? '').includes('count=') ? total : '*'}`;
      if ((headers['accept'] ?? '').includes('vnd.pgrst.object')) {
        if (selected.length === 1) return respond(200, selected[0], { 'content-range': contentRange });
        return respond(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${selected.length} rows` });
      }
      return respond(200, method === 'HEAD' ? undefined : selected, { 'content-range': contentRange });
    } catch (error) {
      if (error instanceof Unsupported) return reject(`unsupported query syntax on "${table}": ${error.message}`);
      throw error;
    }
  });
  return log;
}

/**
 * Deny-by-default network: only the local app server and the intercepted
 * fake backend. Every other HTTP(S) request is aborted, every WebSocket is
 * closed, and both are recorded as unexpected. (Service workers are blocked
 * in playwright.config.ts so none can fetch around these routes.)
 */
export async function installNetworkGuard(context: BrowserContext, appOrigin: string, log: BackendLog) {
  await context.route(
    (url) => url.origin !== appOrigin && url.origin !== FAKE_SUPABASE && (url.protocol === 'http:' || url.protocol === 'https:'),
    async (route) => {
      const request = route.request();
      log.unexpected.push({ kind: 'external', method: request.method(), url: request.url(), reason: 'external host blocked by the e2e network policy' });
      await route.abort('blockedbyclient');
    },
  );
  await context.routeWebSocket(/.*/, (ws) => {
    log.unexpected.push({ kind: 'websocket', method: 'WS', url: ws.url(), reason: 'WebSockets are not part of the fake backend' });
    ws.close({ code: 1008, reason: 'blocked by e2e network policy' });
  });
}
