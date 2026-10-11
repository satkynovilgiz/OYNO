import * as path from 'path';

import type { Page } from '@playwright/test';

import { seededCultureItems } from '../../src/features/culture/glossary/seededCultureItems';
import { FAKE_SUPABASE } from '../fixtures/backend';
import { FIXTURE_TABLES } from '../fixtures/data';
import { buildTables, readTable } from '../fixtures/postgrest';
import { expect, expectNoExposedKeys, expectNoPageErrors, readStored, seed, test } from '../helpers';

/**
 * Contextual vocabulary: article section -> the linked term -> definition,
 * example quoted from the section, honest "no verified recording" -> Add to
 * my review (the existing study queue) -> close -> same place in the article.
 * The fixture article gets its REAL authored "objects used" section (from
 * the seeded migrations), where the reviewed mapping links Түндүк.
 */
const OBJECTS_USED = String(seededCultureItems(path.join(__dirname, '../..')).get('boz-uy-overview')?.objects_used ?? '');

async function withRealSection(page: Page) {
  const rows = FIXTURE_TABLES.culture_items.map((row) => (row.id === 'boz-uy-overview' ? { ...row, objects_used: OBJECTS_USED } : row));
  const tables = buildTables({ ...FIXTURE_TABLES, culture_items: rows });
  await page.route(`${FAKE_SUPABASE}/rest/v1/culture_items*`, async (route) => {
    const request = route.request();
    const read = readTable(tables, 'culture_items', new URL(request.url()).searchParams, request.headers(), request.method() === 'HEAD' ? 'HEAD' : 'GET');
    await route.fulfill({ status: read.status, headers: { 'content-type': 'application/json', ...read.headers }, body: JSON.stringify(read.body) });
  });
}

test('article -> word -> save -> return', async ({ page, errors }) => {
  expect(OBJECTS_USED).toContain('түндүк');
  await withRealSection(page);
  await page.setViewportSize({ width: 390, height: 760 });
  await seed(page, { language: 'kg', guest: true });
  await page.goto('/culture/item/boz-uy-overview');
  const term = page.getByRole('link', { name: /^түндүк,/i }).first();
  await term.scrollIntoViewIfNeeded();
  const before = await term.boundingBox();
  await term.click();
  await expect(page.getByTestId('vocab-example')).toContainText('түндүк');
  await expect(page.getByTestId('vocab-audio')).toContainText('текшерилген жазуусу азырынча жок');
  await page.getByTestId('vocab-save').click();
  await expect(page.getByTestId('vocab-save')).toBeDisabled();
  const study = await readStored<Record<string, Record<string, { needsReview: boolean }>>>(page, 'oyno.glossaryStudy.v1');
  expect(study?.guest?.tunduk?.needsReview).toBe(true);

  // Close: the article is where it was (the term is still in the same place).
  await page.getByRole('button', { name: 'Жабуу' }).last().click();
  await expect(page.getByTestId('vocab-panel')).toHaveCount(0);
  const after = await term.boundingBox();
  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(4);
  // The term is in the existing Glossary review.
  await page.goto('/culture/glossary/study');
  await expect(page.locator('body')).toContainText('Түндүк');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
