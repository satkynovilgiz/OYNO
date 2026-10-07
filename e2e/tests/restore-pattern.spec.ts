import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Restore the Pattern beside the Oymo Creator: tap-to-place, turn, undo/reset, solve, open a copy in the Creator. */

const storageSnapshot = (page: import('@playwright/test').Page) => page.evaluate(() => JSON.stringify(Object.keys(localStorage).filter((key) => /oymo|creation|progress/i.test(key)).map((key) => [key, localStorage.getItem(key)])));

test('solve puzzle 1 by tapping, then open it in the Creator as an unsaved copy', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/oymo/create');
  const before = await storageSnapshot(page);
  await page.getByTestId('restore-entry').click();
  await expect(page).toHaveURL(/\/culture\/oymo\/restore/);
  await expect(page.getByTestId('restore-puzzle-of')).toHaveText('Puzzle 1 of 6');
  // The fixed centre is labelled as already in place.
  await expect(page.getByTestId('restore-board-slot-4')).toHaveAttribute('aria-label', /already in place/);

  await page.getByTestId('restore-piece-piece-0').click();
  await expect(page.getByTestId('restore-selected')).toContainText('Kochkor muyuz');
  await page.getByTestId('restore-board-slot-3').click();
  await expect(page.getByTestId('restore-progress')).toHaveText('1 of 2 pieces in place');
  await page.getByTestId('restore-piece-piece-1').click();
  await page.getByTestId('restore-board-slot-5').click();
  await expect(page.getByTestId('restore-solved')).toBeVisible();

  await page.getByTestId('restore-open-creator').click();
  await expect(page).toHaveURL(/\/culture\/oymo\/create/);
  await expect(page.getByTestId('oymo-handoff-note')).toContainText("it isn't saved yet");
  // Nothing was saved by playing or by opening the copy.
  expect(await storageSnapshot(page)).toBe(before);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('turning, undo and reset behave predictably (puzzle 2)', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/oymo/restore');
  await page.getByTestId('restore-pick-2').click();
  await page.getByTestId('restore-piece-piece-1').click();
  await page.getByTestId('restore-turn').click();
  await expect(page.getByTestId('restore-piece-piece-1')).toHaveAttribute('aria-label', /turned 90°/);
  await page.getByTestId('restore-turn').click();
  await expect(page.getByTestId('restore-piece-piece-1')).toHaveAttribute('aria-label', /turned 180°/);
  await page.getByTestId('restore-undo').click();
  await expect(page.getByTestId('restore-piece-piece-1')).toHaveAttribute('aria-label', /turned 90°/);
  await page.getByTestId('restore-piece-piece-1').click();
  await page.getByTestId('restore-turn').click();
  await page.getByTestId('restore-board-slot-7').click();
  await expect(page.getByTestId('restore-progress')).toHaveText('1 of 3 pieces in place');
  await page.getByTestId('restore-reset').click();
  await expect(page.getByTestId('restore-progress')).toHaveText('0 of 3 pieces in place');
  await expect(page.getByTestId('restore-board-slot-7')).toHaveAttribute('aria-label', /empty/);
  // Hint places one correctly.
  await page.getByTestId('restore-hint').click();
  await expect(page.getByTestId('restore-progress')).toHaveText('1 of 3 pieces in place · 1 hint used');
  expectNoPageErrors(errors);
});

test('accessible, and translated in KG and RU', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/oymo/restore');
  await expectNoSeriousViolations(page, 'restore the pattern');
  await page.getByTestId('restore-piece-piece-0').click();
  await expectNoSeriousViolations(page, 'restore with a piece selected');
  for (const language of ['kg', 'ru'] as const) {
    await page.evaluate((lang) => localStorage.setItem('oyno.language', lang), language);
    await page.goto('/culture/oymo/restore');
    await expect(page.getByTestId('restore-board')).toBeVisible();
    await expectNoExposedKeys(page);
  }
  expectNoPageErrors(errors);
});
