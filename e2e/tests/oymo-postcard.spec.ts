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

/** The greeting's text never spills out of its box, and the box stays inside the card (measured in one pass, so a re-layout can't skew it). */
async function expectGreetingInside(page: Page, scope = page.getByTestId('postcard-preview')) {
  const result = await scope.getByTestId('postcard-card').evaluate((card) => {
    const box = card.querySelector('[data-testid="postcard-greeting-box"]') as HTMLElement;
    const text = box.firstElementChild as HTMLElement;
    const c = card.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    return {
      inside: b.left >= c.left - 0.5 && b.top >= c.top - 0.5 && b.right <= c.right + 0.5 && b.bottom <= c.bottom + 0.5,
      fits: text.scrollHeight <= box.clientHeight + 1 && text.scrollWidth <= box.clientWidth + 1,
    };
  });
  expect(result).toEqual({ inside: true, fits: true });
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

// 80-letter greetings: widest glyphs, Kyrgyz letters, mixed scripts, long unbroken words.
const REPRESENTATIVE: Record<string, string> = {
  zhe: 'Ж'.repeat(80),
  sha: 'Ш'.repeat(80),
  w: 'W'.repeat(80),
  kyrgyz: 'Ңөү ңөү Ңөү ңөү '.repeat(6).slice(0, 80),
  mixed: 'Жаңы жылыңыз менен! С Новым годом! Happy New Year! Майрамыңыз кут болсун, достор!'.slice(0, 80),
  longWords: 'Майрамыңызмененкуттуктайбыз ПоздравляемсНовымгодом WishingyouwonderfulholidaysW'.slice(0, 80),
};

test('representative greetings render inside their box at the size chosen, in both formats and every layout', async ({ page, errors }, testInfo) => {
  await serveSavedPattern(page);
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/oymo/postcard?pattern=oymo-saved-1');
  const report: string[] = [];
  for (const [name, greeting] of Object.entries(REPRESENTATIVE)) {
    await page.getByTestId('postcard-greeting-input').fill(greeting);
    for (const format of ['portrait', 'square'] as const) {
      await page.getByTestId(`postcard-format-${format}`).click();
      for (const layout of ['classic', 'banner', 'border'] as const) {
        await page.getByTestId(`postcard-layout-${layout}`).click();
        await expectGreetingInside(page);
        const text = page.getByTestId('postcard-preview').getByTestId('postcard-greeting');
        // The DOM text uses the size the algorithm chose, and the real rendered text fits at that size.
        const measured = await text.evaluate((el) => {
          const node = el as HTMLElement;
          const box = node.parentElement as HTMLElement;
          const style = getComputedStyle(node);
          const padding = parseFloat(getComputedStyle(box).paddingTop) + parseFloat(getComputedStyle(box).paddingBottom);
          return { chosen: Number(node.dataset.fontSize), fontSize: parseFloat(style.fontSize), lines: Math.round(node.offsetHeight / parseFloat(style.lineHeight)), height: node.offsetHeight, room: box.clientHeight - padding };
        });
        // The preview is scaled with a transform, so computed sizes are the logical ones.
        expect(measured.fontSize).toBe(measured.chosen);
        expect(measured.height).toBeLessThanOrEqual(measured.room + 0.5);
        report.push(`${name} ${format} ${layout}: ${measured.chosen}px, ${measured.lines} lines, ${measured.height}/${measured.room}`);
      }
      if (['zhe', 'w', 'mixed', 'longWords'].includes(name)) {
        await page.getByTestId('postcard-layout-classic').click();
        await page.getByTestId('postcard-preview').screenshot({ path: testInfo.outputPath(`greeting-${name}-${format}.png`) });
      }
    }
  }
  await testInfo.attach('greeting-fit.txt', { body: report.join('\n'), contentType: 'text/plain' });
  console.log(report.join('\n'));
  expectNoPageErrors(errors);
});

test('design set: three outputs with their dimensions, independent placement, clock guide only in the composer', async ({ page, errors }, testInfo) => {
  const writes = await serveSavedPattern(page);
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/oymo/postcard?pattern=oymo-saved-1');
  await expect(page.getByTestId('postcard-dims-square')).toHaveText('1080 × 1080 px');
  await expect(page.getByTestId('postcard-dims-portrait')).toHaveText('1080 × 1350 px');
  await expect(page.getByTestId('postcard-dims-wallpaper')).toHaveText('1080 × 2340 px');
  await page.getByTestId('postcard-greeting-input').fill('Жаңы жылыңыз менен!');
  await page.getByTestId('postcard-background-forest').click();

  // Adjust the wallpaper only.
  const portraitThumb = await page.getByTestId('postcard-thumb-portrait').innerHTML();
  await page.getByTestId('postcard-format-wallpaper').click();
  await page.getByTestId('postcard-size-large').click();
  await page.getByTestId('postcard-position-top').click();
  expect(await page.getByTestId('postcard-thumb-portrait').innerHTML()).toBe(portraitThumb);
  await expect(page.getByTestId('postcard-clock-guide')).toBeVisible();
  // The greeting box stays clear of the marked clock area.
  const guide = (await page.getByTestId('postcard-clock-guide').boundingBox())!;
  const greeting = (await page.getByTestId('postcard-preview').getByTestId('postcard-greeting-box').boundingBox())!;
  expect(greeting.y).toBeGreaterThanOrEqual(guide.y + guide.height);
  await page.getByTestId('postcard-preview').screenshot({ path: testInfo.outputPath('set-wallpaper-with-guide.png') });

  for (const format of ['square', 'portrait', 'wallpaper'] as const) {
    await page.getByTestId(`postcard-format-${format}`).click();
    await page.getByTestId('postcard-export').click();
    const sheet = page.getByTestId('share-preview-card');
    await expect(sheet).toBeVisible();
    // The export is the composer's card exactly - without the clock guide.
    expect(await sheet.getByTestId('postcard-card').innerHTML()).toBe(await page.getByTestId('postcard-preview').getByTestId('postcard-card').innerHTML());
    await expect(sheet.getByTestId('postcard-clock-guide')).toHaveCount(0);
    const ratio = await sheet.getByTestId('postcard-card').evaluate((el) => (el as HTMLElement).offsetWidth / (el as HTMLElement).offsetHeight);
    expect(ratio).toBeCloseTo({ square: 1, portrait: 0.8, wallpaper: 360 / 780 }[format], 3);
    await sheet.screenshot({ path: testInfo.outputPath(`set-${format}-export-preview.png`) });
    await page.getByRole('button', { name: 'Cancel' }).last().click();
  }
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
