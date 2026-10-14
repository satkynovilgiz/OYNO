import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Screen states (docs/SCREEN_STATES.md): loading, failed, unavailable and empty are distinct, and Retry restores the intended screen. */
const FAKE_SUPABASE = 'https://oyno-e2e.test';
const BOOK = { id: 'sbstate1', title: 'Synthetic trip 9s', entries: [], createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };

test('article: a failed load says so (not "not found"), Retry opens the article', async ({ page, errors }) => {
  let failing = true;
  await page.route(`${FAKE_SUPABASE}/rest/v1/culture_items*`, (route) => (failing ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"down"}' }) : route.fallback()));
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/item/boz-uy-tunduk');
  const failed = page.getByTestId('content-state-error');
  await expect(failed).toContainText("Couldn't load this article", { timeout: 30_000 });
  await expect(failed).toContainText('Nothing you saved was changed');
  await expect(page.getByTestId('not-found')).toHaveCount(0);
  await expectNoSeriousViolations(page, 'article load error');
  await page.screenshot({ path: 'e2e/.results/state-article-error.png' });
  failing = false;
  await page.getByTestId('state-retry').click();
  await expect(page.getByTestId('culture-item-title')).toContainText('Түндүк');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('article: a slow load shows the article shape, then explains and offers Try again', async ({ page, errors }) => {
  let hold = true;
  await page.route(`${FAKE_SUPABASE}/rest/v1/culture_items*`, async (route) => {
    while (hold) await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fallback();
  });
  await seed(page, { language: 'kg', guest: true });
  await page.goto('/culture/item/boz-uy-tunduk');
  await expect(page.getByTestId('state-loading')).toContainText('Макала ачылууда');
  await expect(page.getByTestId('state-loading-slow')).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: 'e2e/.results/state-article-slow-kg.png' });
  hold = false;
  await page.getByTestId('state-loading-retry').click();
  await expect(page.getByTestId('culture-item-title')).toBeVisible();
  expectNoPageErrors(errors);
});

test('a scrapbook that cannot be read: an error with Retry (not "not found", not blank); Retry restores it', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.scrapbooks.v1': '{broken' } });
  await page.goto('/profile/scrapbooks/sbstate1');
  await expect(page.getByTestId('scrapbook-state-error')).toContainText('Nothing was changed');
  await expect(page.getByTestId('not-found')).toHaveCount(0);
  await expectNoSeriousViolations(page, 'scrapbook load error');
  // The storage becomes readable again (e.g. after a restart); Retry loads the intended book.
  await page.evaluate((value) => localStorage.setItem('oyno.scrapbooks.v1', value), JSON.stringify({ guest: [BOOK] }));
  await page.getByTestId('scrapbook-detail-retry').click();
  await expect(page.getByTestId('scrapbook-title')).toHaveValue('Synthetic trip 9s');
  expectNoPageErrors(errors);
});

test('Shelf: one failed source keeps the rest visible and gets its own Retry', async ({ page, errors }) => {
  const AT = '2026-10-01T10:00:00.000Z';
  await seed(page, {
    language: 'ru',
    guest: true,
    storage: {
      'oyno.discoveryBoards.v1': '{broken',
      'oyno.timeCapsules.v1': { guest: [{ id: 'tcstate1', status: 'draft', title: 'Synthetic capsule 6s', message: '', articles: [], design: null, openOn: '2027-10-01', createdAt: AT, sealedAt: null, openedAt: null, openedEarly: false, reflection: '', reflectedAt: null }] },
    },
  });
  await page.goto('/profile/shelf');
  await expect(page.getByTestId('shelf-error-board')).toBeVisible();
  await expect(page.getByTestId('shelf-list')).toContainText('Synthetic capsule 6s');
  await expect(page.getByTestId('shelf-empty-board')).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('oyno.discoveryBoards.v1', JSON.stringify({})));
  await page.getByTestId('shelf-retry-board').click();
  await expect(page.getByTestId('shelf-error-board')).toHaveCount(0);
  await expect(page.getByTestId('shelf-list')).toContainText('Synthetic capsule 6s');
  expectNoPageErrors(errors);
});

test('Creator: saved designs failing never touches the canvas; Retry clears it', async ({ page, errors }) => {
  let failing = true;
  await page.route(`${FAKE_SUPABASE}/rest/v1/oymo_creations*`, (route) => (failing ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"down"}' }) : route.fallback()));
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/oymo/create');
  await page.getByRole('button', { name: 'Place at center' }).click();
  await expect(page.getByTestId('oymo-designs-error')).toContainText('The design on the canvas is not affected', { timeout: 30_000 });
  await expect(page.getByLabel('Select motif', { exact: true })).toHaveCount(1);
  failing = false;
  await page.getByTestId('oymo-designs-error-retry').click();
  await expect(page.getByTestId('oymo-designs-error')).toHaveCount(0);
  await expect(page.getByLabel('Select motif', { exact: true })).toHaveCount(1);
  expectNoPageErrors(errors);
});
