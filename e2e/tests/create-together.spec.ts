import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Create Together: A's turn -> pass (design kept) -> B starts -> B's turn (Undo stays in B's turn) -> finish -> Creator copy. */
test('two turns -> finish -> Creator', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/oymo/create');
  await page.getByTestId('together-create-entry').click();
  await expect(page.getByTestId('together-create-setup')).toContainText('nothing is judged');
  await page.getByTestId('together-create-name-a').fill('Aida');
  await page.getByTestId('together-create-turns-2').click();
  await page.getByTestId('together-create-start').click();

  await expect(page.getByTestId('together-create-whose')).toHaveText("Aida's turn · turn 1 of 2");
  await page.getByTestId('together-create-place').click();
  await page.getByTestId('together-create-place').click();
  await expect(page.getByTestId('together-create-count')).toContainText('2 layers');
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousViolations(page, 'create together turn');
  await page.getByTestId('together-create-pass').click();
  await expect(page.getByTestId('together-create-pass-screen')).toContainText('Pass the device to Player B');
  await page.getByTestId('together-create-start-turn').click();

  await expect(page.getByTestId('together-create-whose')).toHaveText("Player B's turn · turn 2 of 2");
  await expect(page.getByTestId('together-create-count')).toContainText('2 layers'); // A's design kept
  await expect(page.getByTestId('together-create-undo')).toBeDisabled(); // nothing of B's to undo yet
  await page.getByTestId('together-create-place').click();
  await page.getByTestId('together-create-undo').click();
  await expect(page.getByTestId('together-create-count')).toContainText('2 layers');
  await expect(page.getByTestId('together-create-undo')).toBeDisabled();
  await page.getByTestId('together-create-place').click();
  // Clearing everything needs a confirmation.
  await page.getByTestId('together-create-reset').click();
  await expect(page.getByTestId('together-create-reset-confirm')).toBeVisible();
  await page.getByRole('button', { name: 'Keep it' }).click();
  await page.getByTestId('together-create-pass').click(); // last turn -> finish

  await expect(page.getByTestId('together-create-finish-screen')).toContainText('Made in 2 turns.');
  await expect(page.getByTestId('together-create-finish-screen')).toContainText('needs a signed-in account');
  await page.getByTestId('together-create-design-name').fill('Synthetic shared pattern');
  await page.getByTestId('together-create-open').click();
  await expect(page).toHaveURL(/\/culture\/oymo\/create$/);
  await expect(page.getByTestId('oymo-handoff-note')).toContainText('unsaved copy of your shared design');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
