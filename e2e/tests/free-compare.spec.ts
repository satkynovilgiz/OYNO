import type { Page } from '@playwright/test';

import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Compare any two culture items: pick a pair from an article, compare, open a source, come back to the same pair. */

async function pickPair(page: Page) {
  await page.goto('/culture/item/boz-uy-karkas');
  await page.getByTestId('compare-from-article').click();
  await expect(page).toHaveURL(/\/culture\/compare\/pick\?left=boz-uy-karkas/);
  await expect(page.getByTestId('fc-picker')).toBeVisible();
  await page.getByTestId('fc-search').fill('Түндүк');
  await page.getByTestId('fc-pick-boz-uy-tunduk').click();
  await expect(page).toHaveURL(/left=boz-uy-karkas&right=boz-uy-tunduk/);
  await expect(page.getByTestId('fc-comparison')).toBeVisible();
}

test('select a pair -> compare -> open a source -> return to the same pair', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await pickPair(page);
  // Both sides in their own words; the curated link between this exact pair, quoted.
  await expect(page.getByTestId('fc-row-origin')).toBeVisible();
  await expect(page.getByTestId('fc-link-tunduk-part-of-karkas')).toContainText('Includes');
  await expect(page.getByText('Not provided').first()).toBeVisible();

  // Replace one side, then swap.
  await page.getByTestId('fc-choose-right').click();
  await page.getByTestId('fc-search').fill('Боз үй');
  await page.getByTestId('fc-pick-boz-uy-overview').click();
  await expect(page).toHaveURL(/right=boz-uy-overview/);
  await page.getByTestId('fc-swap').click();
  await expect(page).toHaveURL(/left=boz-uy-overview&right=boz-uy-karkas/);

  await page.getByTestId('fc-open-boz-uy-karkas').click();
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-karkas$/);
  await page.goBack();
  await expect(page).toHaveURL(/left=boz-uy-overview&right=boz-uy-karkas/);
  await expect(page.getByTestId('fc-comparison')).toBeVisible();
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('an unavailable article is explained, not compared', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/compare/pick?left=boz-uy-karkas&right=boz-uy-kiyiz-jabuu');
  await expect(page.getByTestId('fc-missing-right')).toContainText("isn't available");
  await expect(page.getByTestId('fc-comparison')).toHaveCount(0);
  expectNoPageErrors(errors);
});

test('offline: cached items still compare and can be swapped or replaced', async ({ page, context, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await pickPair(page);
  await context.setOffline(true);
  await page.getByTestId('fc-swap').click();
  await expect(page).toHaveURL(/left=boz-uy-tunduk&right=boz-uy-karkas/);
  await expect(page.getByTestId('fc-row-origin')).toBeVisible();
  await page.getByTestId('fc-choose-right').click();
  await page.getByTestId('fc-search').fill('Боз үй');
  await page.getByTestId('fc-pick-boz-uy-overview').click();
  await expect(page.getByTestId('fc-comparison')).toBeVisible();
  await context.setOffline(false);
  expectNoPageErrors(errors);
});

for (const [name, size] of [
  ['320px phone', { width: 320, height: 800 }],
  ['tablet', { width: 1024, height: 900 }],
] as const) {
  test(`layout at ${name}: paired sections on phones, two columns on tablets`, async ({ page, errors }, testInfo) => {
    await page.setViewportSize(size);
    await seed(page, { language: 'en', guest: true });
    await pickPair(page);
    const left = (await page.getByTestId('fc-origin-left').boundingBox())!;
    const right = (await page.getByTestId('fc-origin-right').boundingBox())!;
    if (size.width < 768) {
      expect(right.y).toBeGreaterThan(left.y + left.height - 1); // stacked
      expect(Math.abs(right.x - left.x)).toBeLessThan(2);
    } else {
      expect(right.x).toBeGreaterThan(left.x + left.width - 1); // side by side
      expect(Math.abs(right.y - left.y)).toBeLessThan(2);
    }
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`compare-${size.width}.png`) });
    expectNoPageErrors(errors);
  });
}

test('KG/RU translated; accessible', async ({ page, errors }) => {
  await seed(page, { language: 'ru', guest: true });
  await pickPair(page);
  await expectNoExposedKeys(page);
  await expectNoSeriousViolations(page, 'free compare');
  expectNoPageErrors(errors);
});
