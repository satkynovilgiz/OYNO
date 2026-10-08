import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Symmetry Playground: tap and drag editing, the real rules, a challenge, undo/reset, and an unsaved copy in the Creator. */

for (const width of [320, 412]) {
  test(`tap, drag, rules, undo/reset at ${width}px`, async ({ page, errors }) => {
    await page.setViewportSize({ width, height: 860 });
    await seed(page, { language: 'en', guest: true });
    await page.goto('/culture/oymo/create');
    await page.getByTestId('symmetry-entry').click();
    await expect(page).toHaveURL(/\/culture\/oymo\/symmetry$/);

    // Tap to place (Mirror is the starting rule): the copy appears in the mirrored column.
    await page.getByTestId('sym-cell-0-1').click();
    await expect(page.getByTestId('sym-result-mark-0-1')).toBeVisible();
    await expect(page.getByTestId('sym-result-mark-4-1')).toBeVisible();
    await expect(page.getByTestId('sym-result-guide-vertical')).toBeVisible();
    await expect(page.getByTestId('sym-result-guide-horizontal')).toHaveCount(0);

    // Four-way: four copies and both guide lines.
    await page.getByTestId('sym-mode-fourWay').click();
    for (const cell of ['0-1', '4-1', '0-3', '4-3']) await expect(page.getByTestId(`sym-result-mark-${cell}`)).toBeVisible();
    await expect(page.getByTestId('sym-result-guide-horizontal')).toBeVisible();
    await expect(page.getByTestId('sym-rule')).toContainText('half a turn');

    // Tap alternative to dragging: pick up, then tap the destination.
    await page.getByTestId('sym-cell-0-1').click();
    await page.getByTestId('sym-cell-1-0').click();
    await expect(page.getByTestId('sym-result-mark-1-0')).toBeVisible();
    await expect(page.getByTestId('sym-result-mark-0-1')).toHaveCount(0);

    // Drag: one cell to the right.
    const piece = (await page.getByTestId('sym-piece-1-0').boundingBox())!;
    await page.mouse.move(piece.x + piece.width / 2, piece.y + piece.height / 2);
    await page.mouse.down();
    await page.mouse.move(piece.x + piece.width * 1.5, piece.y + piece.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByTestId('sym-piece-2-0')).toBeVisible();
    await expect(page.getByTestId('sym-result-mark-2-4')).toBeVisible();

    // Undo the drag, then Reset (and undo that too).
    await page.getByTestId('sym-undo').click();
    await expect(page.getByTestId('sym-piece-1-0')).toBeVisible();
    await page.getByTestId('sym-reset').click();
    await expect(page.locator('[data-testid^="sym-piece-"]')).toHaveCount(0);
    await page.getByTestId('sym-undo').click();
    await expect(page.getByTestId('sym-piece-1-0')).toBeVisible();

    // Guide toggle.
    await page.getByRole('switch').click();
    await expect(page.getByTestId('sym-result-guide-vertical')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: test.info().outputPath(`playground-${width}.png`), fullPage: true });
    expectNoPageErrors(errors);
  });
}

test('a challenge is solved from the model; the design opens in the Creator as an unsaved copy', async ({ page, errors }) => {
  const writes: string[] = [];
  page.on('request', (request) => request.url().includes('oymo_creations') && request.method() !== 'GET' && writes.push(request.method()));
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/oymo/symmetry');
  await page.getByTestId('sym-challenge-twins').click();
  await expect(page.getByTestId('sym-challenge-active')).toContainText('Twin horns');
  await expect(page.getByTestId('sym-mode-fourWay')).toBeDisabled();
  await page.getByTestId('sym-motif-muyuz').click();
  await page.getByTestId('sym-cell-4-1').click();
  await expect(page.getByTestId('sym-status')).toContainText('Still missing: 1');
  await page.getByTestId('sym-motif-gul').click();
  await page.getByTestId('sym-cell-2-3').click();
  await expect(page.getByTestId('sym-status')).toHaveText('Solved - your result matches the target exactly.');

  await page.getByTestId('sym-open-creator').click();
  await expect(page).toHaveURL(/\/culture\/oymo\/create$/);
  await expect(page.getByTestId('oymo-handoff-note')).toContainText('Symmetry Playground');
  expect(writes).toEqual([]);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('works offline; KG and RU translated; accessible', async ({ page, context, errors }) => {
  await seed(page, { language: 'kg', guest: true });
  await page.goto('/culture/oymo/symmetry');
  await expect(page.getByTestId('sym-source')).toBeVisible();
  await context.setOffline(true);
  await page.getByTestId('sym-cell-0-0').click();
  await expect(page.getByTestId('sym-result-mark-4-0')).toBeVisible();
  await expectNoExposedKeys(page);
  await context.setOffline(false);
  expectNoPageErrors(errors);
});

test('accessible playground', async ({ page, errors }) => {
  await seed(page, { language: 'ru', guest: true });
  await page.goto('/culture/oymo/symmetry');
  await page.getByTestId('sym-cell-1-1').click();
  await expectNoExposedKeys(page);
  await expectNoSeriousViolations(page, 'symmetry playground');
  await page.getByTestId('sym-challenge-corners').click();
  await expectNoSeriousViolations(page, 'symmetry challenge');
  expectNoPageErrors(errors);
});
