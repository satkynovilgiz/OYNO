import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';
import type { Page } from '@playwright/test';

/** Oymo Creator composition guides (docs/COMPOSITION_GUIDES.md): view-only guides, artwork-space snapping, one Undo per drag, clean preview/export. */
const motifs = (page: Page) => page.getByLabel('Select motif', { exact: true });
async function frame(page: Page) {
  const canvas = page.getByTestId('oymo-canvas');
  await canvas.scrollIntoViewIfNeeded();
  return (await canvas.boundingBox())!;
}
async function tap(page: Page, x: number, y: number) {
  const box = await frame(page);
  await page.mouse.click(box.x + x, box.y + y);
  await page.waitForTimeout(300); // past the post-gesture quiet window
}
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const box = await frame(page);
  await page.mouse.move(box.x + from.x, box.y + from.y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) await page.mouse.move(box.x + from.x + ((to.x - from.x) * step) / 10, box.y + from.y + ((to.y - from.y) * step) / 10);
  await page.mouse.up();
  await page.waitForTimeout(300);
}
const position = async (page: Page) => [await page.getByTestId('oymo-position-x').inputValue(), await page.getByTestId('oymo-position-y').inputValue()];

test('enable guides -> snap a placement and a drag -> undo -> preview -> export without guides', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/oymo/create');
  const undo = page.getByLabel('Undo', { exact: true });

  // Turning guides on never touches the design: no Undo step appears.
  await page.getByTestId('oymo-guide-axes').click();
  await page.getByTestId('oymo-guide-grid').click();
  await page.getByTestId('oymo-grid-50').click();
  await expect(page.getByTestId('oymo-guide-axes')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('oymo-grid-50')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('oymo-guides')).toBeAttached();
  await expect(undo).toHaveAttribute('aria-disabled', 'true');
  await expectNoSeriousViolations(page, 'guides panel');

  // A tap near the centre line and a grid line snaps (artwork units, 1x): (147, 98) -> (150, 100).
  await tap(page, 147, 98);
  await expect(page.getByTestId('oymo-snap-indicator')).toHaveText('Snapped to a centre line: 150, 100');
  await expect(page.getByTestId('oymo-guide-active').first()).toBeAttached();
  await expect(motifs(page)).toHaveCount(2); // four-way symmetry: (150,100) and (150,200)

  // Select it, then drag it: (150,100) -> near (203,147) snaps to (200,150). One commit.
  await tap(page, 150, 100);
  expect(await position(page)).toEqual(['150', '100']);
  await drag(page, { x: 150, y: 100 }, { x: 203, y: 147 });
  expect(await position(page)).toEqual(['200', '150']);
  await expect(page.getByTestId('oymo-snap-indicator')).toHaveText('Snapped to a centre line: 200, 150');
  await expect(motifs(page)).toHaveCount(2); // a drag moves; it never places

  // Holding Alt places freely: (200,150) -> (213,141), not snapped.
  await page.keyboard.down('Alt');
  await drag(page, { x: 200, y: 150 }, { x: 213, y: 141 });
  await page.keyboard.up('Alt');
  expect(await position(page)).toEqual(['213', '141']);
  await expect(page.getByTestId('oymo-snap-indicator')).toHaveCount(0);
  await page.screenshot({ path: 'e2e/.results/composition-guides.png' });

  // Undo: each committed drag is one step.
  await undo.click();
  await tap(page, 200, 150);
  expect(await position(page)).toEqual(['200', '150']);
  await undo.click();
  await tap(page, 150, 100);
  expect(await position(page)).toEqual(['150', '100']);

  // Preview the final artwork: no guides, symmetry lines or selection; taps don't edit.
  await page.getByTestId('oymo-preview-toggle').click();
  await expect(page.getByTestId('oymo-preview-note')).toBeVisible();
  await expect(page.getByTestId('oymo-guides')).toHaveCount(0);
  await expect(page.locator('[data-testid^="oymo-handle-"]')).toHaveCount(0);
  await expect(page.getByTestId('oymo-position')).toHaveCount(0);
  await tap(page, 40, 260);
  await expect(motifs(page)).toHaveCount(2);
  await page.screenshot({ path: 'e2e/.results/composition-guides-preview.png' });
  await expectNoSeriousViolations(page, 'artwork preview');
  await page.getByTestId('oymo-preview-toggle').click();
  await expect(page.getByTestId('oymo-guides')).toBeAttached();

  // The exported image contains only the artwork.
  await page.getByLabel('Share design', { exact: true }).click();
  const card = page.getByTestId('share-preview-card');
  await expect(card.getByTestId('share-card-artwork')).toBeVisible();
  await expect(card.locator('[data-testid^="oymo-guide"], [data-testid^="oymo-handle-"], [data-testid="oymo-snap-indicator"]')).toHaveCount(0);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('the same artwork point snaps the same at 200% as at 100% (KG)', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await seed(page, { language: 'kg', guest: true });
  await page.goto('/culture/oymo/create');
  await page.getByTestId('oymo-guide-margins').click();
  await page.getByTestId('oymo-guide-grid').click(); // default spacing 25
  await page.getByTestId('oymo-zoom-in').click();
  await page.getByTestId('oymo-zoom-in').click();
  await expect(page.getByTestId('oymo-zoom-level')).toHaveText('200%');
  // Screen (60, 60) at 2x = artwork (105, 105): nearest grid line 100 on both axes.
  await tap(page, 60, 60);
  await expect(page.getByTestId('oymo-snap-indicator')).toHaveText('Торго жабышты: 100, 100');
  await page.getByTestId('oymo-zoom-reset').click();
  await tap(page, 100, 100);
  expect(await position(page)).toEqual(['100', '100']);
  // Screen (32, 270) at 1x: the safe margin (30) wins over nothing else nearby; y 270 is the mirrored margin.
  await tap(page, 32, 270);
  await expect(page.getByTestId('oymo-snap-indicator')).toHaveText('Коопсуз четке жабышты: 30, 270');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
