import type { Page, Route } from '@playwright/test';

import { FIXTURE_TABLES } from './data';

/** The web build is exported with this fake Supabase URL (npm run e2e:build). */
export const FAKE_SUPABASE = 'https://oyno-e2e.test';

export type BackendLog = { method: string; path: string; status: number }[];

/**
 * A deterministic stand-in for the parts of Supabase the guest flows use:
 * PostgREST reads with `eq.` / `in.` filters and single-object responses,
 * accepted-and-discarded writes (analytics), empty RPC results, and auth
 * settings with no OAuth providers. Anything unexpected is answered (so a
 * screen can't hang) AND logged for the failure report.
 */
export async function installBackend(page: Page): Promise<BackendLog> {
  const log: BackendLog = [];
  await page.route(`${FAKE_SUPABASE}/**`, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const respond = async (status: number, body: unknown) => {
      log.push({ method: request.method(), path: url.pathname + url.search, status });
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    };
    if (url.pathname.startsWith('/auth/v1/settings')) return respond(200, { external: { google: false, apple: false, email: true } });
    if (url.pathname.startsWith('/auth/v1/')) return respond(200, {});
    if (url.pathname.startsWith('/rest/v1/rpc/')) return respond(200, null);
    if (url.pathname.startsWith('/storage/')) return respond(404, { message: 'not in fixtures' });
    if (!url.pathname.startsWith('/rest/v1/')) return respond(404, { message: 'unknown endpoint' });
    if (request.method() !== 'GET' && request.method() !== 'HEAD') return respond(201, []);

    const table = url.pathname.slice('/rest/v1/'.length);
    let rows = FIXTURE_TABLES[table];
    if (!rows) return respond(200, []);
    for (const [key, raw] of url.searchParams.entries()) {
      if (['select', 'order', 'limit', 'offset'].includes(key)) continue;
      if (raw.startsWith('eq.')) rows = rows.filter((row) => String(row[key]) === raw.slice(3));
      else if (raw.startsWith('in.(')) {
        const values = raw.slice(4, -1).split(',').map((value) => value.replace(/^"|"$/g, ''));
        rows = rows.filter((row) => values.includes(String(row[key])));
      }
    }
    if ((request.headers()['accept'] ?? '').includes('vnd.pgrst.object')) {
      if (rows.length === 1) return respond(200, rows[0]);
      return respond(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows` });
    }
    return respond(200, rows);
  });
  return log;
}
