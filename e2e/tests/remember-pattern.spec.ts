import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Remember the Pattern: look, hide, rebuild with taps, check, show again (assisted), open the copy in the Creator. */

for (const width of [320, 412]) {
  test(`reconstruction and Creator handoff at ${width}px`, async ({ page, errors }) => {
    const writes: string[] = [];
    page.on('request', (request) => request.url().includes('oymo_creations') && request.method() !== 'GET' && writes.push(request.method()));
    await page.setViewportSize({ width, height: 860 });
    await seed(page, { language: 'en', guest: true });
    await page.goto('/culture/oymo/create');
    await page.getByTestId('remember-entry').click();
    await expect(page).toHaveURL(/\/culture\/oymo\/remember$/);
    await expect(page.getByTestId('remember-setup')).toContainText("doesn't measure memory");
    await page.getByTestId('remember-start').click(); // Easy, untimed: "line" = Gül across the middle row

    // The reference, and the same pattern described in words.
    await expect(page.getByTestId('remember-described')).toContainText('Row 3, column 2: Gül (flower)');
    await expect(page.getByTestId('remember-reference-mark-1-2')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByTestId('remember-hide').click();
    await expect(page.getByTestId('remember-reference-mark-1-2')).toHaveCount(0);

    // Rebuild with taps: two right, one wrong; Check gives gentle feedback.
    await page.getByTestId('remember-motif-gul').click();
    await page.getByTestId('sym-cell-1-2').click();
    await page.getByTestId('sym-cell-2-2').click();
    await page.getByTestId('sym-cell-0-0').click();
    await page.getByTestId('remember-check').click();
    await expect(page.getByTestId('remember-feedback')).toContainText('1 piece still missing');
    await expect(page.getByTestId('remember-feedback')).toContainText("1 piece that isn't in the pattern");
    // Undo the wrong one, look again (assisted), then finish.
    await page.getByTestId('remember-undo').click();
    await page.getByTestId('remember-show-again').click();
    await page.getByTestId('remember-hide').click();
    await page.getByTestId('sym-cell-3-2').click();
    await page.getByTestId('remember-check').click();
    await expect(page.getByTestId('remember-done')).toBeVisible();
    await expect(page.getByTestId('remember-assisted')).toHaveText('With help: you looked again.');
    await expectNoHorizontalOverflow(page);

    await page.getByTestId('remember-open-creator').click();
    await expect(page).toHaveURL(/\/culture\/oymo\/create$/);
    await expect(page.getByTestId('oymo-handoff-note')).toContainText('Remember the Pattern');
    expect(writes).toEqual([]);
    await expectNoExposedKeys(page);
    expectNoPageErrors(errors);
  });
}

test('timed viewing hides by itself; KG/RU; offline; accessible', async ({ page, context, errors }) => {
  await seed(page, { language: 'kg', guest: true });
  await page.goto('/culture/oymo/remember');
  await context.setOffline(true);
  await page.getByTestId('remember-time-10').click();
  await page.getByTestId('remember-start').click();
  await expect(page.getByTestId('remember-time-left')).toBeVisible();
  await expect(page.getByTestId('remember-building')).toBeVisible({ timeout: 15_000 });
  await expectNoExposedKeys(page);
  await expectNoSeriousViolations(page, 'remember building');
  await context.setOffline(false);
  expectNoPageErrors(errors);
});

test('accessible viewing (RU)', async ({ page, errors }) => {
  await seed(page, { language: 'ru', guest: true });
  await page.goto('/culture/oymo/remember');
  await expectNoSeriousViolations(page, 'remember setup');
  await page.getByTestId('remember-start').click();
  await expectNoSeriousViolations(page, 'remember viewing');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
