import * as fs from 'fs';

import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';
import type { Page } from '@playwright/test';

/** Presentation previews: a mockup on paper / fabric / plain; the export follows the choice; the design never changes. */
async function designAndOpenPreview(page: Page) {
  await page.goto('/culture/oymo/create');
  await page.getByTestId('oymo-zoom-controls').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: /Place at center|Ортого кой|Поставить в центр/ }).click();
  await expect(page.getByLabel(/Select motif|Мотивди тандоо|Выбрать мотив/).first()).toBeAttached();
  await page.getByTestId('oymo-surface-preview').click();
  await expect(page).toHaveURL(/\/culture\/oymo\/preview/);
}

test('switch surfaces, colour notes, export follows the choice, the design is unchanged', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await seed(page, { language: 'en', guest: true });
  await designAndOpenPreview(page);
  await expect(page.getByTestId('surface-preview')).toContainText('A visual mockup only');
  await expect(page.getByTestId('surface-stage-paper')).toBeVisible();
  await expect(page.getByTestId('surface-texture-paper')).toBeAttached();
  await expect(page.getByTestId('surface-color-note')).toContainText('warmer and darker');
  await expect(page.getByTestId('surface-stage-paper')).toHaveAttribute('aria-label', /shown on Paper: 1 motif\. A visual mockup\./);
  await expectNoSeriousViolations(page, 'surface preview');
  await page.screenshot({ path: 'e2e/.results/surface-paper.png' });

  // Performance: switching is cheap.
  const times: number[] = [];
  for (let i = 0; i < 12; i++) {
    const id = (['fabric', 'plain', 'paper'] as const)[i % 3];
    const started = Date.now();
    await page.getByTestId(`surface-${id}`).click();
    await expect(page.getByTestId(`surface-stage-${id}`)).toBeVisible();
    times.push(Date.now() - started);
  }
  fs.mkdirSync('e2e/.results', { recursive: true });
  fs.writeFileSync('e2e/.results/surface-switch-ms.txt', `${times.join(', ')}\naverage ${Math.round(times.reduce((a, b) => a + b, 0) / times.length)} ms\n`);
  expect(times.reduce((a, b) => a + b, 0) / times.length).toBeLessThan(250);

  await page.getByTestId('surface-fabric').click();
  await expect(page.getByTestId('surface-color-note')).toContainText('lighter at the top');
  await page.screenshot({ path: 'e2e/.results/surface-fabric.png' });
  await page.getByTestId('surface-plain').click();
  await expect(page.getByTestId('surface-color-note')).toHaveCount(0);
  await expect(page.getByTestId('surface-texture-plain')).toHaveCount(0);

  // Export preview = the chosen surface; leaving it out exports the plain design.
  await page.getByTestId('surface-fabric').click();
  await page.getByTestId('surface-export').click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByTestId('surfaced-artwork-fabric')).toBeVisible();
  await expect(sheet.getByTestId('surface-texture-fabric')).toBeAttached();
  await expect(sheet).not.toContainText('guest');
  await page.screenshot({ path: 'e2e/.results/surface-export-fabric.png' });
  await sheet.getByRole('button', { name: 'Cancel' }).last().click();
  await page.getByTestId('surface-include').click();
  await expect(page.getByTestId('surface-preview')).toContainText('The image will show the plain design');
  await page.getByTestId('surface-export').click();
  await expect(page.getByRole('dialog').getByTestId('surfaced-artwork-plain')).toBeVisible();
  await expect(page.getByRole('dialog').getByTestId('surface-texture-fabric')).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).last().click();

  // Back in the Creator: the design is exactly as it was (one centred motif - its mirrors coincide).
  await page.getByTestId('surface-preview').getByLabel('Back', { exact: true }).click();
  await expect(page).toHaveURL(/\/culture\/oymo\/create/);
  await expect(page.getByLabel('Select motif', { exact: true })).toHaveCount(1);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('without a design there is an honest message (RU)', async ({ page, errors }) => {
  await seed(page, { language: 'ru', guest: true });
  await page.goto('/culture/oymo/preview');
  await expect(page.getByTestId('surface-preview-none')).toContainText('Нет узора для просмотра');
  expectNoPageErrors(errors);
});

test('KG at 320 px: long notes stay on screen', async ({ page, errors }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await seed(page, { language: 'kg', guest: true });
  await designAndOpenPreview(page);
  await page.getByTestId('surface-fabric').click();
  await expectNoHorizontalOverflow(page);
  await expectNoExposedKeys(page);
  await page.screenshot({ path: 'e2e/.results/surface-kg-320.png', fullPage: true });
  expectNoPageErrors(errors);
});
