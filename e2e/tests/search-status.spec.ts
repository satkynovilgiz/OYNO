import type { Page, Route } from '@playwright/test';

import { FAKE_SUPABASE } from '../fixtures/backend';
import { expect, expectNoExposedKeys, expectNoPageErrors, seed, test } from '../helpers';

/**
 * Global Search while catalogues are slow, failing or only partly on the
 * device. Requests are held / failed IN FRONT of the strict fake backend
 * (a later page.route runs first); everything else still goes through it.
 */

const hash = (key: unknown[]) => JSON.stringify(key);
const AT = '2026-10-04T10:00:00.000Z';
const entry = (id: string) => ({ id: `culture_item:${id}`, kind: 'culture_item', contentId: id, queryHashes: [hash(['culture_item', id])], remoteImageUrls: [], downloadedAt: AT, version: 1, requestedBy: ['user'] });

/** Culture items: held until `release()`, or failing until `heal()`. */
async function controlCultureItems(page: Page, mode: 'hold' | 'fail') {
  let open = false;
  let releaseHeld: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (releaseHeld = resolve));
  await page.route(`${FAKE_SUPABASE}/rest/v1/culture_items*`, async (route: Route) => {
    if (open) return route.fallback();
    if (mode === 'hold') {
      await held;
      return route.fallback();
    }
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'e2e: catalogue unavailable' }) });
  });
  return {
    release: () => {
      open = true;
      releaseHeld();
    },
  };
}

const input = (page: Page) => page.getByTestId('search-input');

test('a slow catalogue shows "still loading", never a final "No results"', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  const culture = await controlCultureItems(page, 'hold');
  await page.goto('/search');
  await input(page).fill('Түндүк');
  await expect(page.getByTestId('search-loading')).toBeVisible();
  await expect(page.getByTestId('search-loading')).toContainText('Culture');
  await expect(page.getByTestId('search-empty')).toHaveCount(0);
  culture.release();
  await expect(page.getByTestId('search-result-culture_item-boz-uy-tunduk')).toBeVisible();
  await expect(page.getByTestId('search-loading')).toHaveCount(0);
  expectNoPageErrors(errors);
});

test('a failed catalogue keeps healthy results; Retry keeps the query and the filter', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  const culture = await controlCultureItems(page, 'fail');
  await page.goto('/search');
  await input(page).fill('Боз');
  // Culture categories (a healthy catalogue) still answer; culture items failed.
  await expect(page.getByTestId('search-source-problem')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('search-source-problem')).toContainText("couldn't load");
  await expect(page.getByTestId('search-result-culture_category-boz-uy')).toBeVisible();
  await expect(page.getByTestId('search-empty')).toHaveCount(0);

  await page.getByRole('radio', { name: /^Culture filter/ }).click();
  culture.release();
  await page.getByTestId('search-retry').click();
  await expect(page.getByTestId('search-result-culture_item-boz-uy-overview')).toBeVisible();
  await expect(page.getByTestId('search-source-problem')).toHaveCount(0);
  await expect(input(page)).toHaveValue('Боз');
  await expect(page.getByRole('radio', { name: /^Culture filter/ })).toHaveAttribute('aria-checked', 'true');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('nothing found while a catalogue failed is not a final answer', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  const culture = await controlCultureItems(page, 'fail');
  await page.goto('/search');
  await input(page).fill('Түндүк');
  await expect(page.getByTestId('search-empty-incomplete')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('search-empty')).toHaveCount(0);
  culture.release();
  await page.getByTestId('search-retry').click();
  await expect(page.getByTestId('search-result-culture_item-boz-uy-tunduk')).toBeVisible();
  await expect(input(page)).toHaveValue('Түндүк');
  expectNoPageErrors(errors);
});

test('"Available offline" lists only downloads whose data is really stored', async ({ page, errors }) => {
  await seed(page, {
    language: 'en',
    guest: true,
    storage: {
      // Complete: manifest entry + stored result. Incomplete: entry only (interrupted / cleared).
      'oyno.offline.manifest': { entries: { 'culture_item:boz-uy-overview': entry('boz-uy-overview'), 'culture_item:boz-uy-karkas': entry('boz-uy-karkas') } },
      [`oyno.offline.query:${hash(['culture_item', 'boz-uy-overview'])}`]: { key: ['culture_item', 'boz-uy-overview'], data: { id: 'boz-uy-overview', title: 'Боз үй' }, savedAt: 1759572000000 },
    },
  });
  await page.goto('/search');
  await input(page).fill('Жыгач');
  await expect(page.getByTestId('search-result-culture_item-boz-uy-karkas')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Available offline' }).click();
  await expect(page.getByText('No matching offline items')).toBeVisible();
  await expect(page.getByTestId('search-result-culture_item-boz-uy-karkas')).toHaveCount(0);

  await page.getByTestId('search-input').fill('Боз үй');
  await expect(page.getByTestId('search-result-culture_item-boz-uy-overview')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Available offline' })).toHaveAttribute('aria-checked', 'true');
  expectNoPageErrors(errors);
});

test('clearing the query returns to the start view at once', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/search');
  await input(page).fill('Боз');
  await expect(page.getByTestId('search-result-count')).toBeVisible();
  await input(page).fill('');
  await expect(page.getByTestId('search-result-count')).toHaveCount(0);
  await expect(page.getByText('Browse')).toBeVisible();
  // Rapid edits settle on the LAST query only.
  for (const value of ['Б', 'Бо', 'Боз', 'Бо', 'Түн', 'Түндүк']) await input(page).fill(value);
  await expect(page.getByTestId('search-result-culture_item-boz-uy-tunduk')).toBeVisible();
  await expect(page.getByTestId('search-result-culture_category-boz-uy')).toHaveCount(0);
  expectNoPageErrors(errors);
});

test('status messages follow the app language', async ({ page, errors }) => {
  await seed(page, { language: 'ru', guest: true });
  const culture = await controlCultureItems(page, 'hold');
  await page.goto('/search');
  await input(page).fill('Түндүк');
  await expect(page.getByTestId('search-loading')).toContainText('Культура');
  culture.release();
  await expect(page.getByTestId('search-result-culture_item-boz-uy-tunduk')).toBeVisible();
  expectNoPageErrors(errors);
});
