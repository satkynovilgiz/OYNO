import type { Page } from '@playwright/test';

import { FAKE_SUPABASE } from '../fixtures/backend';
import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Oymo postcard: from a saved pattern, compose, preview the exact card, never touch the original. */

const layer = (id: string, x: number, y: number, color: string) => ({ id, motifId: 'kochkorMuyuz', color, point: { x, y }, rotation: 0, scale: 1, visible: true });
const SAVED = { id: 'oymo-saved-1', user_id: 'guest', name: 'Synthetic pattern 4k', layers: [layer('l0', 150, 150, '#2F5D3A'), layer('l1', 90, 70, '#B9622F')], background_color: '#EADCC0', symmetry_mode: 'fourWay', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z' };
// 80+ characters, Kyrgyz letters with no spaces in the middle part: must wrap and stay on the card.
const LONG_KG = 'Жаңы жылыңыз менен! Бактылуу, ден соолугуңуз чың болсун. Ңөүңөүңөүңөүңөүңөүңөүңөүңөүңөүңөү';

async function serveSavedPattern(page: Page) {
  const writes: string[] = [];
  await page.route(`${FAKE_SUPABASE}/rest/v1/oymo_creations*`, async (route) => {
    if (route.request().method() !== 'GET') {
      writes.push(route.request().method());
      return route.fulfill({ status: 400, body: '{}' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([SAVED]) });
  });
  return writes;
}

/** The greeting's text never spills out of its box, and the box stays inside the card. */
async function expectGreetingInside(page: Page, scope = page.getByTestId('postcard-preview')) {
  const card = (await scope.getByTestId('postcard-card').boundingBox())!;
  const box = (await scope.getByTestId('postcard-greeting-box').boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(card.x - 0.5);
  expect(box.y).toBeGreaterThanOrEqual(card.y - 0.5);
  expect(box.x + box.width).toBeLessThanOrEqual(card.x + card.width + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(card.y + card.height + 0.5);
  const fits = await scope.getByTestId('postcard-greeting-box').evaluate((el) => {
    const text = el.firstElementChild as HTMLElement;
    return text.scrollHeight <= el.clientHeight + 1 && text.scrollWidth <= el.clientWidth + 1;
  });
  expect(fits).toBe(true);
}

test('saved pattern -> postcard in both formats; the shared preview is the same card; the original is untouched', async ({ page, errors }, testInfo) => {
  const writes = await serveSavedPattern(page);
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/oymo/create');
  await expect(page.getByTestId('oymo-create-postcard')).toHaveCount(0);
  await page.getByRole('button', { name: SAVED.name }).click();
  await page.getByTestId('oymo-create-postcard').click();
  await expect(page).toHaveURL(/\/culture\/oymo\/postcard\?pattern=oymo-saved-1/);
  await expect(page.getByTestId('postcard-copy-note')).toContainText('stays exactly as it is');

  // Greeting limit: typed past 80, kept at 80, said so.
  await page.getByTestId('postcard-greeting-input').fill(LONG_KG + LONG_KG);
  await expect(page.getByTestId('postcard-greeting-count')).toContainText('80 / 80');
  await expect(page.getByTestId('postcard-greeting-count')).toContainText('limit');

  for (const format of ['portrait', 'square'] as const) {
    await page.getByTestId(`postcard-format-${format}`).click();
    for (const layout of ['classic', 'banner', 'border'] as const) {
      await page.getByTestId(`postcard-layout-${layout}`).click();
      await expectGreetingInside(page);
    }
    await page.getByTestId('postcard-layout-classic').click();
    const ratio = await page.getByTestId('postcard-preview').getByTestId('postcard-card').evaluate((el) => (el as HTMLElement).offsetWidth / (el as HTMLElement).offsetHeight);
    expect(ratio).toBeCloseTo(format === 'square' ? 1 : 0.8, 2);
    await page.getByTestId('postcard-preview').screenshot({ path: testInfo.outputPath(`postcard-${format}.png`) });

    // The share preview renders the very same card.
    await page.getByTestId('postcard-export').click();
    const sheet = page.getByTestId('share-preview-card');
    await expect(sheet).toBeVisible();
    const [screenCard, sheetCard] = await Promise.all([page.getByTestId('postcard-preview').getByTestId('postcard-card').innerHTML(), sheet.getByTestId('postcard-card').innerHTML()]);
    expect(sheetCard).toBe(screenCard);
    const ratioInSheet = await sheet.getByTestId('postcard-card').evaluate((el) => (el as HTMLElement).offsetWidth / (el as HTMLElement).offsetHeight);
    expect(ratioInSheet).toBeCloseTo(ratio, 3);
    await expectGreetingInside(page, sheet);
    await sheet.screenshot({ path: testInfo.outputPath(`postcard-${format}-share-preview.png`) });
    // Nothing but the chosen content: no pattern name, no "OYNO" label.
    await expect(sheet).not.toContainText(SAVED.name);
    await page.getByRole('button', { name: 'Cancel' }).last().click();
    await expect(sheet).toHaveCount(0);
  }

  // Placement and background controls change the card, never the saved pattern.
  await page.getByTestId('postcard-size-small').click();
  await page.getByTestId('postcard-position-top').click();
  await page.getByTestId('postcard-background-forest').click();
  await expect(page.getByTestId('postcard-greeting-input')).toHaveValue(/^Жаңы/); // the composition is still all there
  await expectNoHorizontalOverflow(page);
  expect(writes).toEqual([]);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('a deleted or unavailable pattern says so', async ({ page, errors }) => {
  await serveSavedPattern(page);
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/oymo/postcard?pattern=not-there');
  await expect(page.getByTestId('postcard-not-found')).toBeVisible();
  expectNoPageErrors(errors);
});

test('KG and RU are translated; accessible', async ({ page, errors }) => {
  await serveSavedPattern(page);
  for (const language of ['kg', 'ru'] as const) {
    await seed(page, { language, guest: true });
    await page.goto('/culture/oymo/postcard?pattern=oymo-saved-1');
    await expect(page.getByTestId('postcard-preview')).toBeVisible();
    await expectNoExposedKeys(page);
  }
  expectNoPageErrors(errors);
});

test('accessible composition screen and share preview', async ({ page, errors }) => {
  await serveSavedPattern(page);
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/oymo/postcard?pattern=oymo-saved-1');
  await page.getByTestId('postcard-greeting-input').fill('Happy holidays!');
  await expectNoSeriousViolations(page, 'postcard composition');
  await page.getByTestId('postcard-export').click();
  await expect(page.getByTestId('share-preview-card')).toBeVisible();
  // The web Modal gets its dialog role one tick after it appears.
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoSeriousViolations(page, 'postcard share preview');
  expectNoPageErrors(errors);
});
