import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Remember the Pattern together: A makes -> privacy screen -> B Ready -> look -> hide -> rebuild -> done -> swap roles. */
for (const width of [320, 412]) {
  test(`create -> pass -> rebuild -> swap roles at ${width}px`, async ({ page, errors }) => {
    await page.setViewportSize({ width, height: 860 });
    await seed(page, { language: 'en', guest: true });
    await page.goto('/culture/oymo/remember');
    await page.getByTestId('remember-together-entry').click();
    await expect(page).toHaveURL(/remember-together$/);
    await page.getByTestId('together-name-a').fill('Aida');
    await page.getByTestId('together-start').click();

    // A makes a pattern; Pass is refused under 3 pieces.
    await expect(page.getByTestId('together-authoring')).toContainText('Aida, make a pattern');
    await page.getByTestId('remember-motif-muyuz').click();
    await page.getByTestId('sym-cell-0-0').click();
    await page.getByTestId('together-pass').click();
    await expect(page.getByTestId('together-problems')).toContainText('Add at least 3 pieces.');
    await page.getByTestId('remember-motif-gul').click();
    await page.getByTestId('sym-cell-2-2').click();
    await page.getByTestId('sym-cell-4-1').click();
    await expect(page.getByTestId('together-count')).toHaveText('3 of 7 pieces placed');
    await page.getByTestId('together-pass').click();

    // The privacy screen shows nothing of the pattern.
    await expect(page.getByTestId('together-pass-screen')).toContainText('Pass the device to Player B');
    await expect(page.locator('[data-testid^="remember-reference"], [data-testid="remember-described"], [data-testid^="sym-"]')).toHaveCount(0);
    await expectNoSeriousViolations(page, 'pass screen');
    await page.getByTestId('together-ready').click();

    // B looks (grid + described list), hides, rebuilds.
    await expect(page.getByTestId('remember-viewing')).toContainText("Player B, look at Aida's pattern");
    await expect(page.getByTestId('remember-described')).toContainText('Row 1, column 1: Müyüz');
    await page.getByTestId('remember-hide').click();
    await page.getByTestId('remember-motif-muyuz').click();
    await page.getByTestId('sym-cell-0-0').click();
    await page.getByTestId('remember-motif-gul').click();
    await page.getByTestId('sym-cell-2-2').click();
    await page.getByTestId('remember-check').click();
    await expect(page.getByTestId('remember-feedback')).toContainText('1 piece still missing');
    await page.getByTestId('remember-show-again').click();
    await page.getByTestId('remember-hide').click();
    await page.getByTestId('sym-cell-4-1').click();
    await page.getByTestId('remember-check').click();
    await expect(page.getByTestId('together-done')).toContainText("Player B rebuilt Aida's pattern");
    await expect(page.getByTestId('together-assisted')).toHaveText('With help: you looked again.');
    await expectNoHorizontalOverflow(page);

    // Swap: B makes the next one, from an empty grid.
    await page.getByTestId('together-swap').click();
    await expect(page.getByTestId('together-authoring')).toContainText('Player B, make a pattern');
    await expect(page.getByTestId('together-count')).toHaveText('0 of 7 pieces placed');
    await expect(page.locator('[data-testid^="sym-piece-"]')).toHaveCount(0);
    await expectNoExposedKeys(page);
    expectNoPageErrors(errors);
  });
}

test('offline, KG, open the rebuild in the Creator as an unsaved copy', async ({ page, context, errors }) => {
  await seed(page, { language: 'kg', guest: true });
  await page.goto('/culture/oymo/remember-together');
  await context.setOffline(true);
  await page.getByTestId('together-start').click();
  for (const cell of ['sym-cell-0-0', 'sym-cell-1-1', 'sym-cell-2-2']) await page.getByTestId(cell).click();
  await page.getByTestId('together-pass').click();
  await page.getByTestId('together-ready').click();
  await page.getByTestId('remember-hide').click();
  for (const cell of ['sym-cell-0-0', 'sym-cell-1-1', 'sym-cell-2-2']) await page.getByTestId(cell).click();
  await page.getByTestId('remember-check').click();
  await expect(page.getByTestId('together-done')).toBeVisible();
  await expectNoExposedKeys(page);
  await page.getByTestId('together-open-creator').click();
  await expect(page).toHaveURL(/\/culture\/oymo\/create$/);
  await expect(page.getByTestId('oymo-handoff-note')).toBeVisible();
  expectNoPageErrors(errors);
});
