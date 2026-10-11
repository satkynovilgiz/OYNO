import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Border Workshop: tile -> frame (corners once, overlap note, max count) -> preview -> unsaved Creator copy. */
for (const width of [320, 412]) {
  test(`tile -> frame -> Creator at ${width}px`, async ({ page, errors }) => {
    await page.setViewportSize({ width, height: 860 });
    await seed(page, { language: 'en', guest: true });
    await page.goto('/culture/oymo/create');
    await page.getByTestId('border-entry').click();
    await expect(page.getByTestId('border-workshop')).toContainText('no traditional name or meaning');

    // Two motifs in the tile; turn one.
    await page.getByTestId('border-cell-0-0').click();
    await page.getByTestId('border-cell-2-2').click();
    await page.getByTestId('border-cell-2-2').click();
    await page.getByTestId('border-rotate').click();
    await expect(page.getByTestId('border-cell-2-2')).toHaveAttribute('aria-label', /turned 45°/);

    // A frame, 60 pt tiles, 4 per side: 12 tiles (corners once), 24 layers.
    await page.getByTestId('border-size-60').click();
    await page.getByTestId('border-layout-frame').click();
    await page.getByTestId('border-count-up').click(); // 3 -> 4
    await expect(page.getByTestId('border-summary')).toContainText('12 tiles in the design, 24 layers');
    // Spacing below 0: overlap is explained (and allowed).
    await page.getByTestId('border-spacing-down').click();
    await expect(page.getByTestId('border-overlap')).toContainText('overlap by 5 pt');
    await page.getByTestId('border-spacing-up').click();
    await expect(page.getByTestId('border-overlap')).toHaveCount(0);
    // The most that fits: 5 x 60 = 300.
    await page.getByTestId('border-count-up').click();
    await expect(page.getByTestId('border-count-up')).toBeDisabled();
    await expect(page.getByTestId('border-max-note')).toBeVisible();
    await expect(page.getByTestId('border-summary')).toContainText('16 tiles in the design, 32 layers');
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousViolations(page, 'border workshop');

    await page.getByTestId('border-open').click();
    await expect(page).toHaveURL(/\/culture\/oymo\/create$/);
    await expect(page.getByTestId('oymo-handoff-note')).toContainText('unsaved copy from the Border Workshop');

    // Back: the tile is still there, unchanged.
    await page.goBack();
    await expect(page.getByTestId('border-summary')).toContainText('Row 3, column 3: Müyüz (horn), green, turned 45°');
    await expectNoExposedKeys(page);
    expectNoPageErrors(errors);
  });
}

test('RU, offline, reduced motion: strips work', async ({ page, context, errors }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, { language: 'ru', guest: true });
  await page.goto('/culture/oymo/border');
  await context.setOffline(true);
  await page.getByTestId('border-cell-1-1').click();
  await page.getByTestId('border-layout-vertical').click();
  await expect(page.getByTestId('border-summary')).toContainText('Вертикальная полоса');
  await expect(page.getByTestId('border-open')).toBeEnabled();
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
