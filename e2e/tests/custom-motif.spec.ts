import type { Page } from '@playwright/test';

import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, readStored, seed, test } from '../helpers';

/** Custom motif: draw on the grid -> undo/redo -> move -> save -> place in a new design -> reopen after a restart. */
const CELL = 12;
async function tapGrid(page: Page, x: number, y: number) {
  const box = (await page.getByTestId('custom-motif-grid').boundingBox())!;
  await page.mouse.click(box.x + x * CELL + 1, box.y + y * CELL + 1);
}
const visible = (page: Page, id: string) => page.locator(`[data-testid="${id}"]`).locator('visible=true');

test('create motif -> place -> save -> reopen', async ({ page, errors }) => {
  await page.setViewportSize({ width: 412, height: 900 });
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/oymo/motifs');
  await expect(page.getByTestId('custom-motifs')).toContainText("isn't a traditional Oymo motif");
  await page.getByTestId('custom-motif-new').click();
  await page.getByTestId('custom-motif-name').fill('Zigzag test');

  await tapGrid(page, 2, 2);
  await tapGrid(page, 20, 2);
  await page.getByTestId('custom-motif-tool-circle').click();
  await tapGrid(page, 12, 12);
  await tapGrid(page, 16, 12);
  await page.getByTestId('custom-motif-tool-polygon').click();
  await tapGrid(page, 4, 20);
  await tapGrid(page, 12, 16);
  await tapGrid(page, 20, 20);
  await page.getByTestId('custom-motif-close').click();
  await expect(page.locator('[data-testid^="custom-motif-part-"]')).toHaveCount(3);
  await expect(page.getByTestId('custom-motif-part-0')).toContainText('Line from (2, 2) to (20, 2)');
  await expect(page.getByTestId('custom-motif-part-1')).toContainText('radius 4');

  await page.getByTestId('custom-motif-undo').click();
  await expect(page.locator('[data-testid^="custom-motif-part-"]')).toHaveCount(2);
  await page.getByTestId('custom-motif-redo').click();
  await page.getByTestId('custom-motif-part-0').getByRole('button').first().click();
  await page.getByTestId('custom-motif-move-down-0').click();
  await expect(page.getByTestId('custom-motif-part-0')).toContainText('Line from (2, 3) to (20, 3)');
  await expectNoSeriousViolations(page, 'motif editor');

  await page.getByTestId('custom-motif-save').click();
  await expect(page).toHaveURL(/\/culture\/oymo\/motifs\/cm-/);
  await expect(visible(page, 'custom-motif-saved')).toBeVisible();
  const stored = await readStored<Record<string, Record<string, { primitives: unknown[]; name: string }>>>(page, 'oyno.customMotifs.v1');
  const [saved] = Object.values(stored!.guest);
  expect(saved.name).toBe('Zigzag test');
  expect(saved.primitives).toHaveLength(3);

  // Place it: the Creator draws the same geometry the preview did.
  const previewPaths = await visible(page, 'custom-motif-preview').locator('path').evaluateAll((els) => els.slice(0, 2).map((el) => el.getAttribute('d')));
  await visible(page, 'custom-motif-place').click();
  await expect(page).toHaveURL(/\/culture\/oymo\/create/);
  await expect(visible(page, 'oymo-handoff-note')).toContainText('user-created motif');
  const creatorPaths = await page.locator('[role="group"]').locator('visible=true').first().locator('path').evaluateAll((els) => els.map((el) => el.getAttribute('d')));
  expect(creatorPaths).toEqual(expect.arrayContaining(previewPaths));

  // Reopen after a restart.
  await page.goto('/culture/oymo/motifs');
  await page.locator('[data-testid^="custom-motif-cm-"]').first().click();
  await expect(page.locator('[data-testid^="custom-motif-part-"]')).toHaveCount(3);
  await expect(page.getByTestId('custom-motif-part-0')).toContainText('Line from (2, 3) to (20, 3)');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
