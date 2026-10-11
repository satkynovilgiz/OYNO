import type { Page } from '@playwright/test';

import { FAKE_SUPABASE } from '../fixtures/backend';
import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, readStored, seed, test } from '../helpers';

/** Oymo Design Portfolio: create -> choose and arrange saved designs -> captions -> grid / single / list -> export preview -> reopen. */
const layer = (id: string, x: number) => ({ id, motifId: 'gul', color: '#2F5233', point: { x, y: 150 }, rotation: 0, scale: 1, visible: true });
const ROWS = [
  { id: 'design-a', user_id: 'guest', name: 'Synthetic design A', layers: [layer('l0', 90), layer('l1', 210)], background_color: '#EADCC0', symmetry_mode: 'mirror', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z' },
  { id: 'design-b', user_id: 'guest', name: 'Synthetic design B', layers: [layer('l0', 150)], background_color: '#FBF3E3', symmetry_mode: 'none', created_at: '2026-10-02T10:00:00Z', updated_at: '2026-10-02T10:00:00Z' },
];
async function serve(page: Page, rows: unknown[]) {
  const writes: string[] = [];
  await page.route(`${FAKE_SUPABASE}/rest/v1/oymo_creations*`, async (route) => {
    if (route.request().method() !== 'GET') {
      writes.push(route.request().method());
      return route.fulfill({ status: 400, body: '{}' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
  });
  return writes;
}

test('create -> arrange -> preview -> reopen', async ({ page, errors }) => {
  const writes = await serve(page, ROWS);
  await page.setViewportSize({ width: 360, height: 860 });
  await seed(page, { language: 'en', guest: true });
  await page.goto('/profile/oymo-portfolios');
  await expect(page.getByTestId('portfolio-list')).toContainText('no traditional meaning');
  await page.getByTestId('portfolio-new-title').fill('Synthetic portfolio 3p');
  await page.getByTestId('portfolio-create').click();
  await expect(page).toHaveURL(/\/profile\/oymo-portfolios\/pf/);

  await page.getByTestId('portfolio-pick-design-a').click();
  await page.getByTestId('portfolio-pick-design-b').click();
  await page.getByTestId('portfolio-down-0').click(); // B first
  await expect(page.getByTestId('portfolio-entry-0')).toContainText('Synthetic design B');
  await page.getByTestId('portfolio-caption-1').fill('Synthetic caption 8r');
  await expect(page.getByTestId('portfolio-unsaved')).toBeVisible();
  await page.getByTestId('portfolio-save').click();
  await expect(page.getByTestId('portfolio-unsaved')).toHaveCount(0);

  await page.getByTestId('portfolio-mode-grid').click();
  await expect(page.getByTestId('portfolio-grid')).toContainText('Your captionSynthetic caption 8r');
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousViolations(page, 'portfolio grid');
  await page.getByTestId('portfolio-mode-single').click();
  await expect(page.getByTestId('portfolio-single')).toContainText('Design 1 of 2');
  await page.getByTestId('portfolio-next').click();
  await expect(page.getByTestId('portfolio-single')).toContainText('Synthetic design A');
  await page.getByTestId('portfolio-mode-list').click();
  await expect(page.getByTestId('portfolio-text-list')).toContainText('1. Synthetic design B');
  await expect(page.getByTestId('portfolio-text-list')).toContainText('2 motifs');

  // The export card shows exactly its fields.
  await page.getByTestId('portfolio-export-pick-1').click();
  await expect(page.getByTestId('portfolio-export-title')).toHaveText('Synthetic portfolio 3p');
  await expect(page.getByTestId('portfolio-export-name')).toHaveText('Synthetic design A');
  await expect(page.getByTestId('portfolio-export-caption')).toHaveText('Synthetic caption 8r');

  // Reopen after a restart.
  const stored = await readStored<Record<string, { id: string; entries: { creationId: string }[] }[]>>(page, 'oyno.oymoPortfolios.v1');
  expect(stored?.guest?.[0].entries.map((entry) => entry.creationId)).toEqual(['design-b', 'design-a']);
  await page.goto('/profile/oymo-portfolios');
  await page.getByTestId(`portfolio-open-${stored!.guest[0].id}`).click();
  await expect(page.getByTestId('portfolio-entry-1')).toContainText('Synthetic design A');
  await expect(page.getByTestId('portfolio-caption-1')).toHaveValue('Synthetic caption 8r');
  expect(writes).toEqual([]); // the saved designs were never written
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('a deleted design stays as a labelled placeholder that can be removed (RU)', async ({ page, errors }) => {
  await serve(page, [ROWS[1]]);
  await seed(page, { language: 'ru', guest: true, storage: { 'oyno.oymoPortfolios.v1': { guest: [{ id: 'pfsynthetic1', title: 'Synthetic', intro: '', entries: [{ creationId: 'design-a', caption: 'Kept caption 2t' }, { creationId: 'design-b', caption: '' }], createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z' }] } } });
  await page.goto('/profile/oymo-portfolios/pfsynthetic1');
  await expect(page.getByTestId('portfolio-missing-0')).toContainText('больше не сохранён');
  await expect(page.getByTestId('portfolio-caption-0')).toHaveValue('Kept caption 2t');
  await page.getByTestId('portfolio-remove-0').click();
  await page.getByTestId('portfolio-save').click();
  await expect(page.getByTestId('portfolio-missing-0')).toHaveCount(0);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
