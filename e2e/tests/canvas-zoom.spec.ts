import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';
import type { Page } from '@playwright/test';

/**
 * Oymo canvas zoom / pan / precise positioning (canvasViewport.ts):
 * zoomed tap -> right artwork point; a drag pans and never places; a tap
 * on a motif selects it; numeric moves agree with taps; moves undo as one.
 */
const motifs = (page: Page) => page.getByLabel('Select motif', { exact: true });
/** A tap at a point of the canvas frame (re-measured each time: other controls scroll the page). */
async function tapCanvas(page: Page, x: number, y: number) {
  const canvas = page.getByTestId('oymo-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + x, box.y + y);
}

test('zoomed tap, pan without placing, select, numeric move, undo', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/oymo/create');
  const canvas = page.getByTestId('oymo-canvas');
  await canvas.scrollIntoViewIfNeeded();

  await page.getByTestId('oymo-zoom-in').click();
  await page.getByTestId('oymo-zoom-in').click();
  await expect(page.getByTestId('oymo-zoom-level')).toHaveText('200%');

  const box = (await canvas.boundingBox())!;
  // Screen (60, 60) at 2x around the centre = artwork (105, 105).
  await tapCanvas(page, 60, 60);
  await expect(motifs(page)).toHaveCount(4); // four-way symmetry

  // A drag pans (by -80, -80) - and adds nothing.
  await page.mouse.move(box.x + 200, box.y + 200);
  await page.mouse.down();
  for (let step = 1; step <= 8; step++) await page.mouse.move(box.x + 200 - step * 10, box.y + 200 - step * 10);
  await page.mouse.up();
  await expect(motifs(page)).toHaveCount(4);

  // Panned by -80: the copy mirrored to artwork (195, 195) is drawn at screen (195-150)*2+150-80 = 160.
  // Tapping it selects the layer (no new motif); the fields show the layer's own point.
  await tapCanvas(page, 160, 160);
  await expect(motifs(page)).toHaveCount(4);
  await expect(page.getByTestId('oymo-position-x')).toHaveValue('105');
  await expect(page.getByTestId('oymo-position-y')).toHaveValue('105');
  await expect(page.getByTestId('oymo-handle-0')).toBeVisible();
  await expectNoSeriousViolations(page, 'zoomed canvas with position controls');
  await page.screenshot({ path: 'e2e/.results/canvas-zoom.png' });

  // Numeric movement in artwork units.
  await page.getByTestId('oymo-step-10').click();
  await page.getByTestId('oymo-move-right').click();
  await expect(page.getByTestId('oymo-position-x')).toHaveValue('115');
  await page.getByTestId('oymo-position-y').fill('40');
  await page.getByTestId('oymo-position-y').press('Enter');
  await expect(page.getByTestId('oymo-position-y')).toHaveValue('40');

  // An empty spot (artwork (255, 127), away from every copy) places a second motif.
  await page.getByTestId('oymo-position-y').blur();
  await tapCanvas(page, 280, 24); // inside the rounded corner
  await expect(motifs(page)).toHaveCount(8);

  // Undo: the placement, then the whole run of moves as ONE step.
  await page.getByLabel('Undo', { exact: true }).click();
  await expect(motifs(page)).toHaveCount(4);
  await page.getByLabel('Undo', { exact: true }).click();
  await tapCanvas(page, 160, 160);
  await expect(page.getByTestId('oymo-position-x')).toHaveValue('105');
  await expect(page.getByTestId('oymo-position-y')).toHaveValue('105');

  await page.getByTestId('oymo-zoom-reset').click();
  await expect(page.getByTestId('oymo-zoom-level')).toHaveText('100%');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('at 1x the plain canvas behaviour is unchanged (tap places at the tapped point)', async ({ page, errors }) => {
  await seed(page, { language: 'kg', guest: true });
  await page.goto('/culture/oymo/create');
  const canvas = page.getByTestId('oymo-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await tapCanvas(page, 40, 250);
  await expect(page.getByLabel(/./).and(page.locator('[aria-label]')).first()).toBeVisible();
  await tapCanvas(page, 40, 250);
  await expect(page.getByTestId('oymo-position-x')).toHaveValue('40');
  await expect(page.getByTestId('oymo-position-y')).toHaveValue('250');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
