import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, LANGUAGES, readStored, seed, test } from '../helpers';
import type { Page } from '@playwright/test';

/** Focus view: enter and leave from the keyboard, stay in the same section, keep the essentials, never complete by scrolling. */
const ARTICLE = '/culture/item/boz-uy-tunduk';
const SECTION = 'cultural_meaning';

async function scrollToSection(page: Page, key: string) {
  // Reach the section by real scrolling (so it becomes the current section), not a jump.
  const anchor = page.getByTestId(`section-bookmark-${key}`);
  for (let i = 0; i < 40 && !(await anchor.isVisible().then(async (visible) => visible && (await anchor.boundingBox())!.y < 420)); i++) await page.mouse.wheel(0, 140);
  await page.mouse.wheel(0, 40);
  await page.waitForTimeout(300);
}

const inView = async (page: Page, testId: string) => {
  const box = await page.getByTestId(testId).boundingBox();
  const height = page.viewportSize()!.height;
  return !!box && box.y > -40 && box.y < height;
};

test('keyboard: enter -> same section, essentials kept -> Escape -> same section; no completion by scrolling', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await seed(page, { language: 'en', guest: true });
  await page.goto(ARTICLE);
  await expect(page.getByTestId('culture-item-title')).toBeVisible();
  await page.mouse.move(195, 500);
  await scrollToSection(page, SECTION);
  expect(await inView(page, `section-bookmark-${SECTION}`)).toBe(true);

  // Enter from the keyboard, from where the reader is (the floating entry never scrolls the article).
  await page.getByTestId('focus-view-floating').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('focus-exit-bar')).toContainText('Focus view is on');
  await page.waitForTimeout(500);
  expect(await inView(page, `section-bookmark-${SECTION}`)).toBe(true);
  await expect(page.getByTestId('focus-view-toggle')).toHaveAttribute('aria-pressed', 'true');
  // Secondary interface steps back; notes, sources and glossary stay.
  await expect(page.getByLabel('Share', { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-testid^="section-bookmark-"]')).toHaveCount(4);
  await expect(page.getByTestId('explain-entry')).toHaveCount(0);
  await expectNoSeriousViolations(page, 'focus view');
  await page.screenshot({ path: 'e2e/.results/focus-view-en.png' });

  // Scrolling to the very end in Focus view never marks the article read.
  for (let i = 0; i < 30; i++) await page.mouse.wheel(0, 400);
  await page.waitForTimeout(600);
  const reading = await readStored<Record<string, Record<string, { furthest: number; completedAt: string | null }>>>(page, 'oyno.reading.v1');
  const record = reading?.guest?.['culture_item:boz-uy-tunduk'];
  expect(record?.furthest ?? 0).toBeGreaterThan(0.9);
  expect(record?.completedAt).toBeNull();

  // Back to the section, then leave with Escape: still there.
  await page.goto(`${ARTICLE}`);
  await expect(page.getByTestId('focus-exit-bar')).toBeVisible(); // the device setting is kept
  await page.mouse.move(195, 500);
  await scrollToSection(page, SECTION);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('focus-exit-bar')).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(await inView(page, `section-bookmark-${SECTION}`)).toBe(true);
  await expect(page.getByLabel('Share', { exact: true })).toHaveCount(1);
  expect((await readStored<{ focusMode: boolean }>(page, 'oyno.readerSettings.v1'))?.focusMode).toBe(false);
  expectNoPageErrors(errors);
});

test('the exit button leaves Focus view and the setting stays in the reader sheet too', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.readerSettings.v1': { textSize: 'default', lineSpacing: 'comfortable', focusMode: true } } });
  await page.goto(ARTICLE);
  await page.getByTestId('focus-view-exit').click();
  await expect(page.getByTestId('focus-exit-bar')).toHaveCount(0);
  await expect(page.getByTestId('explain-entry')).toBeVisible();
  expectNoPageErrors(errors);
});

for (const language of LANGUAGES) {
  test(`long text in Focus view stays readable (${language.toUpperCase()}, XL text, 320 px)`, async ({ page, errors }) => {
    await page.setViewportSize({ width: 320, height: 760 });
    await seed(page, { language, guest: true, storage: { 'oyno.readerSettings.v1': { textSize: 'xl', lineSpacing: 'spacious', focusMode: true } } });
    await page.goto(ARTICLE);
    await expect(page.getByTestId('focus-exit-bar')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoExposedKeys(page);
    await page.screenshot({ path: `e2e/.results/focus-view-320-${language}.png` });
    expectNoPageErrors(errors);
  });
}
