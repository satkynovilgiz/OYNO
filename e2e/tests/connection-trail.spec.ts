import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/**
 * Follow the Connection: start from an article, follow sourced links, open
 * articles and come back without losing the trail, retrace any step, and
 * see missing content as unavailable (the fixture data has no
 * boz-uy-kiyiz-jabuu / boz-uy-ichki-jasalga articles).
 */

test('explore and retrace a trail; missing nodes do not break it', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/item/boz-uy-karkas');
  await page.getByTestId('trail-start').click();
  await expect(page).toHaveURL(/\/culture\/connections\/trail\?start=boz-uy-karkas/);

  // From the frame: the tündük (reverse "Includes") and the boz üy are followable; the felt covers article is missing.
  await expect(page.getByTestId('trail-option-boz-uy-tunduk')).toContainText('Includes');
  await expect(page.getByTestId('trail-option-boz-uy-overview')).toContainText('Part of');
  await expect(page.getByTestId('trail-option-boz-uy-overview')).toContainText('Sourced link');
  await expect(page.getByTestId('trail-unavailable-boz-uy-kiyiz-jabuu')).toBeVisible();

  // Each link has its explanation and opens its source.
  await page.getByTestId('trail-source-boz-uy-overview').click();
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-karkas$/);
  await page.goBack();

  await page.getByTestId('trail-follow-boz-uy-overview').click();
  await expect(page.getByTestId('trail-here')).toContainText('Боз үй');
  // No loop: the frame we came from is not offered again.
  await expect(page.getByTestId('trail-option-boz-uy-karkas')).toHaveCount(0);
  await expect(page.getByText(/leads? back to (an object|objects) already on your trail/)).toBeVisible();

  // Open the article and come back: the trail is still there.
  await page.getByTestId('trail-open-article').click();
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-overview$/);
  await page.goBack();
  await expect(page.getByTestId('trail-step-1')).toBeVisible();
  await expect(page.getByTestId('trail-here')).toContainText('Боз үй');

  // Retrace: back to step 1 (later step stays listed), then follow another way.
  await page.getByTestId('trail-step-0').click();
  await expect(page.getByTestId('trail-here')).toContainText('каркас');
  await expect(page.getByTestId('trail-step-1')).toBeVisible();
  await page.getByTestId('trail-forward').click();
  await expect(page.getByTestId('trail-here')).toContainText('Боз үй');
  await page.getByTestId('trail-back').click();
  await page.getByTestId('trail-follow-boz-uy-tunduk').click();
  // The list view shows the same trail, readable.
  await page.getByTestId('trail-view-list').click();
  await expect(page.getByTestId('trail-list')).toContainText('1.');
  await expect(page.getByTestId('trail-step-1')).toContainText('Includes');
  await expect(page.getByTestId('trail-step-1')).toContainText('Түндүк');
  await expect(page.getByTestId('trail-step-2')).toHaveCount(0); // following anew replaced what came after
  await expect(page.getByTestId('trail-dead-end')).toBeVisible();
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('a missing start object says so', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/connections/trail?start=boz-uy-kiyiz-jabuu');
  await expect(page.getByTestId('trail-missing-start')).toBeVisible();
  expectNoPageErrors(errors);
});

test('KG and RU are translated; accessible in both views', async ({ page, errors }) => {
  for (const language of ['kg', 'ru'] as const) {
    await seed(page, { language, guest: true });
    await page.goto('/culture/connections/trail?start=boz-uy-karkas');
    await expect(page.getByTestId('trail-here')).toBeVisible();
    await expectNoExposedKeys(page);
  }
  expectNoPageErrors(errors);
});

test('accessible trail, path and list', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/connections/trail?start=boz-uy-karkas');
  await page.getByTestId('trail-follow-boz-uy-overview').click();
  await expectNoSeriousViolations(page, 'trail path view');
  await page.getByTestId('trail-view-list').click();
  await expectNoSeriousViolations(page, 'trail list view');
  expectNoPageErrors(errors);
});
