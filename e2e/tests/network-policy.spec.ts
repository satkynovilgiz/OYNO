import { FAKE_SUPABASE } from '../fixtures/backend';
import { expect, seed, takeUnexpected, test } from '../helpers';

/**
 * The fake backend is strict and the network is deny-by-default. These
 * tests provoke each kind of unexpected request and check it is refused
 * and reported (and, unconsumed, fails the test).
 */

type Init = { method?: string; body?: string; headers?: Record<string, string> };
const call = (page: import('@playwright/test').Page, url: string, init: Init = {}) =>
  page.evaluate(
    async ({ url, init }) => {
      try {
        const response = await fetch(url, { ...init, headers: { apikey: 'e2e-anon-key', 'content-type': 'application/json', ...init.headers } });
        return { status: response.status, body: await response.text() };
      } catch (error) {
        return { status: -1, body: String(error) };
      }
    },
    { url, init },
  );

test.beforeEach(async ({ page }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/home');
  await expect(page.getByTestId('home-screen')).toBeVisible();
});

test('unknown table is refused and reported', async ({ page, backend }) => {
  const result = await call(page, `${FAKE_SUPABASE}/rest/v1/user_progress?select=*`);
  expect(result.status).toBe(400);
  expect(takeUnexpected(backend)).toEqual([expect.objectContaining({ kind: 'backend', reason: expect.stringContaining('table "user_progress" is not mocked') })]);
});

test('unknown RPC is refused and reported', async ({ page, backend }) => {
  await call(page, `${FAKE_SUPABASE}/rest/v1/rpc/delete_own_account`, { method: 'POST', body: '{}' });
  expect(takeUnexpected(backend)).toEqual([expect.objectContaining({ reason: expect.stringContaining('RPC "delete_own_account" is not registered') })]);
});

test('unexpected write is refused; analytics is accepted and discarded', async ({ page, backend }) => {
  await call(page, `${FAKE_SUPABASE}/rest/v1/culture_items`, { method: 'POST', body: '{"id":"x"}' });
  await call(page, `${FAKE_SUPABASE}/rest/v1/user_settings`, { method: 'PATCH', body: '{}' });
  expect(takeUnexpected(backend).map((request) => request.reason)).toEqual([expect.stringContaining('write POST culture_items'), expect.stringContaining('write PATCH user_settings')]);
  const analytics = await call(page, `${FAKE_SUPABASE}/rest/v1/analytics_events`, { method: 'POST', body: '{"name":"e2e"}' });
  expect(analytics.status).toBe(201);
  expect(backend.unexpected).toEqual([]);
});

test('unsupported query syntax fails instead of being ignored', async ({ page, backend }) => {
  await call(page, `${FAKE_SUPABASE}/rest/v1/culture_items?title=like.*Боз*`);
  await call(page, `${FAKE_SUPABASE}/rest/v1/culture_items?select=*,culture_categories(*)`);
  await call(page, `${FAKE_SUPABASE}/rest/v1/culture_items?no_such_column=eq.1`);
  // Unknown column after a filter that already left zero rows - still refused.
  await call(page, `${FAKE_SUPABASE}/rest/v1/culture_items?id=eq.missing&no_such_column=eq.1`);
  await call(page, `${FAKE_SUPABASE}/rest/v1/culture_items?select=id,no_such_column`);
  await call(page, `${FAKE_SUPABASE}/rest/v1/culture_items?order=no_such_column.asc`);
  // Each reason names the table and the offending column / syntax.
  expect(takeUnexpected(backend).map((request) => request.reason)).toEqual([
    expect.stringContaining('culture_items: unsupported operator in filter "title=like'),
    expect.stringContaining('culture_items: embedded resources'),
    expect.stringContaining('culture_items: unknown column "no_such_column" in filter'),
    expect.stringContaining('culture_items: unknown column "no_such_column" in filter'),
    expect.stringContaining('culture_items: unknown column "no_such_column" in select'),
    expect.stringContaining('culture_items: unknown column "no_such_column" in order'),
  ]);
});

test('filtering, ordering and pagination behave like PostgREST', async ({ page, backend }) => {
  const read = async (query: string, headers: Record<string, string> = {}) => JSON.parse((await call(page, `${FAKE_SUPABASE}/rest/v1/culture_items?${query}`, { headers })).body);
  expect((await read('select=id&category_id=eq.boz-uy&order=sort_order.desc')).map((row: { id: string }) => row.id)).toEqual(['boz-uy-tunduk', 'boz-uy-karkas', 'boz-uy-overview']);
  expect((await read('select=id&order=sort_order.asc&limit=2&offset=1')).map((row: { id: string }) => row.id)).toEqual(['boz-uy-karkas', 'boz-uy-tunduk']);
  expect(await read('select=id&order=sort_order.asc', { range: '3-4' })).toEqual([{ id: 'shyrdak-craft' }, { id: 'oymo-overview' }]);
  expect(await read('select=id&id=in.(oymo-overview,boz-uy-karkas)&order=id.asc')).toEqual([{ id: 'boz-uy-karkas' }, { id: 'oymo-overview' }]);
  expect(backend.unexpected).toEqual([]);
});

test('external HTTP is blocked and reported', async ({ page, backend }) => {
  const result = await call(page, 'https://example.com/tracker.js');
  expect(result.status).toBe(-1);
  expect(takeUnexpected(backend)).toEqual([expect.objectContaining({ kind: 'external', url: 'https://example.com/tracker.js' })]);
});

test('WebSockets are blocked and reported', async ({ page, backend }) => {
  const closed = await page.evaluate(
    (url) =>
      new Promise<number>((resolve) => {
        const socket = new WebSocket(url);
        socket.onclose = (event) => resolve(event.code);
      }),
    'wss://oyno-e2e.test/realtime/v1/websocket',
  );
  expect(closed).not.toBe(1000);
  expect(takeUnexpected(backend)).toEqual([expect.objectContaining({ kind: 'websocket' })]);
});

test('service workers cannot register (they could bypass interception)', async ({ page }) => {
  // serviceWorkers: 'block' (playwright.config.ts) turns register() into a no-op.
  const state = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { registrations: 0, controlled: false };
    await navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    return { registrations: (await navigator.serviceWorker.getRegistrations()).length, controlled: !!navigator.serviceWorker.controller };
  });
  expect(state).toEqual({ registrations: 0, controlled: false });
});

// An unexpected request that nobody consumes must FAIL the test.
test('an unconsumed unexpected request fails the test', async ({ page }) => {
  test.fail();
  await call(page, `${FAKE_SUPABASE}/rest/v1/rpc/merge_journal_entries`, { method: 'POST', body: '{}' });
});
