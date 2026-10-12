import type { Page } from '@playwright/test';

import { FAKE_SUPABASE } from '../fixtures/backend';
import { FIXTURE_TABLES } from '../fixtures/data';
import { buildTables, readTable } from '../fixtures/postgrest';
import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Source Lens: article section -> About this information -> sources / personal note kept apart -> Source Explorer -> back to the same place. */
const SOURCES = ['https://ky.wikipedia.org/wiki/Example_e2e', 'Printed book, p. 12'];

async function withSources(page: Page) {
  const rows = FIXTURE_TABLES.culture_items.map((row) => (row.id === 'boz-uy-karkas' ? { ...row, sources: SOURCES, accuracy_level: 'verified' } : row));
  const tables = buildTables({ ...FIXTURE_TABLES, culture_items: rows });
  await page.route(`${FAKE_SUPABASE}/rest/v1/culture_items*`, async (route) => {
    const request = route.request();
    const read = readTable(tables, 'culture_items', new URL(request.url()).searchParams, request.headers(), request.method() === 'HEAD' ? 'HEAD' : 'GET');
    await route.fulfill({ status: read.status, headers: { 'content-type': 'application/json', ...read.headers }, body: JSON.stringify(read.body) });
  });
  // The external site itself is never contacted in tests.
  await page.context().route('https://ky.wikipedia.org/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>external</p>' }));
}

test('article section -> Source Lens -> return', async ({ page, errors }) => {
  await withSources(page);
  await page.setViewportSize({ width: 390, height: 860 });
  const bookmarks = { guest: { 'culture_item:boz-uy-karkas#history': { contentType: 'culture_item', contentId: 'boz-uy-karkas', sectionKey: 'history', articleTitle: 'Жыгач каркас', sectionLabel: 'History', note: 'Synthetic private note 3z', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' } } };
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.sectionBookmarks.v1': bookmarks } });
  await page.goto('/culture/item/boz-uy-karkas');
  const toggle = page.getByTestId('source-lens-history');
  await toggle.scrollIntoViewIfNeeded();
  await toggle.click();
  const panel = page.getByTestId('source-lens-panel-history');
  await expect(panel).toContainText("OYNO's article text");
  await expect(panel).toContainText("doesn't record which source supports this particular section");
  await expect(page.getByTestId('source-lens-source-0')).toContainText('Wikipedia (кыргызча)');
  await expect(page.getByTestId('source-lens-unavailable-1')).toContainText("isn't a working web link");
  await expect(panel).toContainText('Contributor quotations: none are recorded');
  // The personal note is listed as the reader's own - not among the sources.
  await expect(page.getByTestId('source-lens-personal')).toContainText('Synthetic private note 3z');
  await expect(page.getByTestId('source-lens-source-0')).not.toContainText('Synthetic private note');
  await expectNoSeriousViolations(page, 'source lens');

  // Opening a source: exactly the recorded URL, nothing appended.
  const [popup] = await Promise.all([page.context().waitForEvent('page'), page.getByTestId('source-lens-open-0').click()]);
  expect(decodeURI(popup.url())).toBe(SOURCES[0]);
  await popup.close();

  // To the article's Source Explorer and back: same section, lens still open, same position.
  const before = (await toggle.boundingBox())!.y;
  await page.getByTestId('source-lens-explorer-history').click();
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-karkas\/sources$/);
  await page.goBack();
  await expect(page.locator('[data-testid="source-lens-panel-history"]').locator('visible=true')).toBeVisible();
  const after = (await page.locator('[data-testid="source-lens-history"]').locator('visible=true').boundingBox())!.y;
  expect(Math.abs(after - before)).toBeLessThan(40);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('no recorded sources: an honest fallback (RU)', async ({ page, errors }) => {
  await seed(page, { language: 'ru', guest: true });
  await page.goto('/culture/item/boz-uy-overview');
  await page.getByTestId('source-lens-origin').click();
  await expect(page.getByTestId('source-lens-none')).toContainText('Сведения об источнике недоступны');
  await expect(page.getByTestId('source-lens-none')).toContainText('не значит, что информация неверна');
  await expect(page.getByTestId('source-lens-personal')).toHaveCount(0);
  expectNoPageErrors(errors);
});
