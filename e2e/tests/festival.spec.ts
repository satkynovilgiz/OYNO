import { expect, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Festival Mode: a two-activity guest session in a chosen language -> open, return, next -> end -> summary; app language restored. */
test('two-activity session -> summary -> cleared', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await seed(page, { language: 'en', guest: true });
  await page.goto('/home');
  await page.getByTestId('chooser-entry').click();
  await page.locator('[data-testid="festival-entry"]').locator('visible=true').click();

  const setup = page.getByTestId('festival-setup');
  await expect(setup).toContainText('No account needed');
  await page.getByTestId('festival-length-5').click();
  await page.getByTestId('festival-language-ru').click();
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousViolations(page, 'festival setup');
  await page.getByTestId('festival-start-quick-play').click();

  // The session runs in the language chosen for it.
  const session = page.getByTestId('festival-session');
  await expect(session).toContainText('Следующее занятие');
  await expect(page.getByTestId('festival-next')).toBeDisabled(); // explicit: open first, or skip
  await page.getByTestId('festival-open-0').click();
  await expect(page).toHaveURL(/\/games\/jaa-atuu/);
  await page.goBack();
  await expect(page.getByTestId('festival-item-0')).toContainText('Открыто');
  await page.getByTestId('festival-next').click();
  await expect(page.getByTestId('festival-item-0')).toContainText('Изучено');

  await page.getByTestId('festival-open-1').click();
  await expect(page).toHaveURL(/\/games\/kyz-kuumai/);
  await page.goBack();
  await page.getByTestId('festival-next').click();
  await expect(page.getByTestId('festival-all-done')).toBeVisible();
  await expectNoSeriousViolations(page, 'festival session');
  // The saved app language was never replaced by the session's.
  expect(await page.evaluate(() => localStorage.getItem('oyno.language'))).toBe('en');

  await page.getByTestId('festival-end').click();
  const summary = page.getByTestId('festival-summary');
  await expect(summary).toContainText('What the group explored'); // back in English
  await expect(summary).toContainText(/Jaa|Kyz/i);
  await expect(summary).not.toContainText(/\d+ ?(points|%)|\d+ ?\/ ?\d+/i); // no aggregate score
  await page.getByTestId('festival-another').click();
  await expect(page.getByTestId('festival-setup')).toBeVisible(); // temporary state cleared
  expectNoPageErrors(errors);
});

test('ending during a shared-device activity asks first', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/festival');
  await page.getByTestId('festival-length-10').click();
  await page.getByTestId('festival-start-together-10').click();
  await page.getByTestId('festival-open-0').click();
  await expect(page).toHaveURL(/\/culture\/duel/);
  await page.goBack();
  await page.getByTestId('festival-end').click();
  await expect(page.getByTestId('festival-end-confirm')).toContainText('still open');
  await page.getByRole('button', { name: 'Keep going' }).click();
  await expect(page.getByTestId('festival-session')).toBeVisible();
  await page.getByTestId('festival-end').click();
  await page.getByTestId('festival-end-yes').click();
  await expect(page.getByTestId('festival-summary')).toContainText('Nothing was marked as explored.');
  expectNoPageErrors(errors);
});
