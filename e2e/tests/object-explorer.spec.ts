import type { Page } from '@playwright/test';

import { FAKE_SUPABASE } from '../fixtures/backend';
import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Object Explorer (internal schematic fixture, admin-gated): select part -> source article -> back -> same part. */
async function asEditor(page: Page) {
  await page.route(`${FAKE_SUPABASE}/rest/v1/rpc/current_admin_role`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify('content_editor') }));
}
/** Where a marker's centre is, relative to the drawn image. */
async function relative(page: Page, id: string) {
  const image = (await page.getByTestId('explorer-image').boundingBox())!;
  const marker = (await page.getByTestId(`explorer-point-${id}`).boundingBox())!;
  return { x: (marker.x + marker.width / 2 - image.x) / image.width, y: (marker.y + marker.height / 2 - image.y) / image.height };
}

for (const width of [320, 412]) {
  test(`select part -> source -> return keeps the selection (${width}px)`, async ({ page, errors }) => {
    await asEditor(page);
    await page.setViewportSize({ width, height: 900 });
    await seed(page, { language: 'en', guest: true });
    await page.goto('/admin/explorer');
    await expect(page.getByTestId('explorer-fixture-banner')).toContainText('not a reviewed illustration');

    // Points stay on the same spot of the image at every zoom.
    const before = await relative(page, 'tunduk');
    expect(before.x).toBeCloseTo(0.5, 1);
    expect(before.y).toBeCloseTo(0.16, 1);
    await page.getByTestId('explorer-point-uuk').click();
    await page.getByTestId('explorer-zoom-in').click();
    await page.getByTestId('explorer-zoom-in').click();
    await expect(page.getByTestId('explorer-zoom')).toContainText('2×');
    const zoomed = await relative(page, 'tunduk');
    expect(zoomed.x).toBeCloseTo(before.x, 2);
    expect(zoomed.y).toBeCloseTo(before.y, 2);
    await expect(page.getByTestId('explorer-selected')).toContainText('Uuk'); // zoom kept the selection
    await page.getByTestId('explorer-reset').click();
    await expect(page.getByTestId('explorer-selected')).toContainText('The roof poles.');
    await expect(page.getByTestId('explorer-source')).toContainText('Source:');

    // The list says the same as the image.
    for (const id of ['tunduk', 'uuk', 'kerege', 'bosogo']) await expect(page.getByTestId(`explorer-row-${id}`)).toBeVisible();
    await expect(page.getByTestId('explorer-row-uuk')).toContainText('The roof poles.');
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousViolations(page, 'object explorer');
    await expectNoExposedKeys(page);

    await page.getByTestId('explorer-open-source').click();
    await expect(page).toHaveURL(/\/culture\/item\/boz-uy-overview\?section=objects_used/);
    await page.goBack();
    await expect(page.locator('[data-testid="explorer-selected"]').locator('visible=true')).toContainText('Uuk');
    expectNoPageErrors(errors);
  });
}

test('selecting from the numbered list; a removed source is explained (RU)', async ({ page, errors }) => {
  await asEditor(page);
  await page.route(`${FAKE_SUPABASE}/rest/v1/culture_items*`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await seed(page, { language: 'ru', guest: true });
  await page.goto('/admin/explorer');
  await page.getByTestId('explorer-row-kerege').click();
  await expect(page.getByTestId('explorer-selected')).toContainText('Кереге');
  await expect(page.getByTestId('explorer-source-unavailable')).toContainText('больше недоступна');
  await expect(page.getByTestId('explorer-open-source')).toHaveCount(0);
  expectNoPageErrors(errors);
});

test('non-admins get the not-found screen', async ({ page, errors }) => {
  await page.route(`${FAKE_SUPABASE}/rest/v1/rpc/current_admin_role`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await seed(page, { language: 'en', guest: true });
  await page.goto('/admin/explorer');
  await expect(page.getByTestId('explorer')).toHaveCount(0);
  expectNoPageErrors(errors);
});
