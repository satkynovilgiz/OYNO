import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, readStored, seed, test } from '../helpers';

/** My Next Visit: build a plan -> reorder -> start -> return -> finished -> the next one; restarts keep it. */
const visible = (page: import('@playwright/test').Page, id: string) => page.locator(`[data-testid="${id}"]`).locator('visible=true');

test('build queue -> open -> return -> finish -> next', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/item/boz-uy-overview');
  await page.getByTestId('next-visit-add-boz-uy-overview').click();
  await page.getByTestId('next-visit-in-boz-uy-overview').click();
  await expect(page).toHaveURL(/\/profile\/next-visit$/);

  await visible(page, 'next-visit-add-activity-detective').click();
  await visible(page, 'next-visit-add-activity-jaaAtuu').click();
  await expect(visible(page, 'next-visit-item-2')).toContainText('Activity');
  // Reorder: the detective activity first.
  await visible(page, 'next-visit-up-1').click();
  await expect(visible(page, 'next-visit-item-0')).toContainText('next up');
  await expect(visible(page, 'next-visit-item-1')).toContainText('Боз үй');
  await expect(visible(page, 'next-visit')).toContainText("not one of OYNO's Learning Paths");
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousViolations(page, 'next visit');
  const firstTitle = (await visible(page, 'next-visit-item-0').textContent()) ?? '';

  // Start -> the activity's own screen -> back: opened, NOT finished.
  await visible(page, 'next-visit-open-0').click();
  await expect(page).toHaveURL(/\/culture\/detective/);
  await page.goBack();
  await expect(visible(page, 'next-visit-choice-0')).toContainText('Is it done?');
  await expect(page.locator('[data-testid^="next-visit-item-"]').locator('visible=true')).toHaveCount(3);

  // Finished -> off the plan; the article is next.
  await visible(page, 'next-visit-finish-0').click();
  await expect(page.locator('[data-testid^="next-visit-item-"]').locator('visible=true')).toHaveCount(2);
  await expect(visible(page, 'next-visit-item-0')).toContainText('next up');
  await expect(visible(page, 'next-visit-item-0')).toContainText('Боз үй');
  expect(firstTitle).not.toContain('Боз үй');
  await visible(page, 'next-visit-open-0').click();
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-overview$/);
  await page.goBack();
  await visible(page, 'next-visit-later-0').click(); // keep for later -> to the end
  await expect(visible(page, 'next-visit-item-1')).toContainText('Боз үй');

  // A restart keeps the order and state.
  await page.reload();
  await expect(visible(page, 'next-visit-item-0')).toContainText('next up');
  await expect(visible(page, 'next-visit-item-1')).toContainText('Боз үй');
  const stored = await readStored<Record<string, { kind: string; id: string; openedAt: string | null }[]>>(page, 'oyno.nextVisit.v1');
  expect(stored!.guest.map((item) => `${item.kind}:${item.id}:${item.openedAt === null}`)).toEqual(['activity:jaaAtuu:true', 'article:boz-uy-overview:true']);

  // Clearing asks first.
  await visible(page, 'next-visit-clear').click();
  await visible(page, 'next-visit-clear-yes').click();
  await expect(visible(page, 'next-visit-empty')).toBeVisible();
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('a missing item does not block the rest (RU)', async ({ page, errors }) => {
  await seed(page, { language: 'ru', guest: true, storage: { 'oyno.nextVisit.v1': { guest: [{ kind: 'article', id: 'removed-article', titleSnapshot: 'Старая статья', addedAt: '2026-10-01T00:00:00Z', openedAt: null }, { kind: 'activity', id: 'jaaAtuu', titleSnapshot: '', addedAt: '2026-10-01T00:00:00Z', openedAt: null }], 'user-x': [{ kind: 'activity', id: 'duel', titleSnapshot: '', addedAt: '', openedAt: null }] } } });
  await page.goto('/profile/next-visit');
  await expect(page.getByTestId('next-visit-unavailable-0')).toContainText('больше недоступно');
  await expect(page.getByTestId('next-visit-item-0')).toContainText('Старая статья');
  await expect(page.getByTestId('next-visit-open-0')).toHaveCount(0);
  await expect(page.getByTestId('next-visit-item-1')).toContainText('следующее'); // the next AVAILABLE item is up next
  await expect(page.locator('[data-testid^="next-visit-item-"]')).toHaveCount(2); // only this owner's plan
  await page.getByTestId('next-visit-remove-0').click();
  await expect(page.locator('[data-testid^="next-visit-item-"]')).toHaveCount(1);
  await page.getByTestId('next-visit-open-0').click();
  await expect(page).toHaveURL(/\/games\/jaa-atuu/);
  expectNoPageErrors(errors);
});
