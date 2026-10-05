import type { BrowserContext, Page, Route } from '@playwright/test';

import { FIXTURE_TABLES } from './data';
import { buildTables, readTable, Unsupported } from './postgrest';

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

/** Public read-only tables: schema in fixtures/schema.ts, rows in fixtures/data.ts (checked at load). */
const TABLES = buildTables(FIXTURE_TABLES);

/** Writes that are allowed and DISCARDED (nothing is stored). */
export const DISCARDED_WRITES: Record<string, readonly string[]> = {
  // Product analytics (src/services/analytics/analytics.ts) - fire-and-forget inserts.
  analytics_events: ['POST'],
};

/** RPCs the guest journeys call, with their deterministic results. None today. */
export const RPCS: Record<string, unknown> = {};

/** Auth endpoints a signed-out (guest) client may call. */
const AUTH_GET: Record<string, unknown> = {
  '/auth/v1/settings': { external: { google: false, apple: false, email: true } },
};

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
    try {
      const response = readTable(TABLES, table, url.searchParams, request.headers(), method as 'GET' | 'HEAD');
      return respond(response.status, response.body, response.headers);
    } catch (error) {
      if (error instanceof Unsupported) return reject(error.message);
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
