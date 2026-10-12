import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Prepare for offline: My Next Visit plan -> see readiness -> download the missing article -> go offline -> it opens. */
const PLAN = { guest: [{ kind: 'article', id: 'boz-uy-tunduk', titleSnapshot: 'Түндүк', addedAt: '2026-10-01T00:00:00Z', openedAt: null }, { kind: 'activity', id: 'jaaAtuu', titleSnapshot: '', addedAt: '2026-10-01T00:00:00Z', openedAt: null }, { kind: 'activity', id: 'daily', titleSnapshot: '', addedAt: '2026-10-01T00:00:00Z', openedAt: null }] };
const visible = (page: import('@playwright/test').Page, id: string) => page.locator(`[data-testid="${id}"]`).locator('visible=true');

test('prepare the plan -> offline -> the article opens', async ({ page, context, errors }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.nextVisit.v1': PLAN } });
  await page.goto('/profile/next-visit');
  await page.getByTestId('next-visit-prepare').click();
  await expect(page).toHaveURL(/\/prepare-offline$/);

  await expect(visible(page, 'prepare-state-0')).toHaveText('Not downloaded yet · Size unknown');
  await expect(visible(page, 'prepare-state-1')).toHaveText('Built into the app - works offline');
  await expect(visible(page, 'prepare-state-2')).toContainText("Can't be prepared"); // Daily is never promised
  await expect(visible(page, 'prepare-summary')).toContainText('Ready offline: 1 of 3');
  await expect(visible(page, 'prepare-summary')).toContainText('size unknown until downloaded');
  await expect(visible(page, 'prepare-offline')).toContainText('never part of this');
  await expectNoSeriousViolations(page, 'prepare offline');

  await visible(page, 'prepare-download').click();
  await expect(visible(page, 'prepare-state-0')).toHaveText('Downloaded - works offline', { timeout: 15_000 });
  await expect(visible(page, 'prepare-summary')).toContainText('Ready offline: 2 of 3');
  await expect(visible(page, 'prepare-summary')).toContainText(/Already stored on this device: \d/);
  await expect(visible(page, 'prepare-all-ready')).toContainText('Everything that can be prepared is ready');

  // Offline: the prepared article opens from the plan.
  await page.goBack();
  await context.setOffline(true);
  await expect(visible(page, 'next-visit-item-0')).toContainText('Works offline');
  await visible(page, 'next-visit-open-0').click();
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-tunduk$/);
  await expect(visible(page, 'culture-item-title')).toHaveText('Түндүк');
  await context.setOffline(false);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('a journey shows its steps; Manage downloads is reachable (RU)', async ({ page, errors }) => {
  await seed(page, { language: 'ru', guest: true });
  await page.goto('/prepare-offline');
  await expect(page.getByTestId('prepare-empty')).toBeVisible(); // empty plan
  await page.getByTestId('prepare-source-boz-uy').click();
  await expect(page.locator('[data-testid^="prepare-resource-"]').first()).toBeVisible();
  await expect(page.getByTestId('prepare-summary')).toContainText('Готово офлайн');
  await page.getByTestId('prepare-manage').click();
  await expect(page).toHaveURL(/\/offline$/);
  expectNoPageErrors(errors);
});
