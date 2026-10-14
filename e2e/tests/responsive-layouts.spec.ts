import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, LANGUAGES, seed, test } from '../helpers';
import type { Page } from '@playwright/test';

/** Tablet and wide layouts (docs/RESPONSIVE_LAYOUTS.md). */
const SIZES = { phone: { width: 390, height: 844 }, tablet: { width: 820, height: 1180 }, landscape: { width: 1180, height: 820 }, wide: { width: 1440, height: 900 } } as const;
const AT = '2026-10-01T10:00:00.000Z';
const SHELF = {
  'oyno.discoveryBoards.v1': { guest: [{ id: 'bresp1', title: 'Synthetic board 1r', question: 'What connects these objects?', promptId: 'connects', cards: [], links: [], createdAt: AT, updatedAt: AT }] },
  'oyno.timeCapsules.v1': { guest: [{ id: 'tcresp1', status: 'draft', title: 'Synthetic capsule 2r', message: '', articles: [], design: null, openOn: '2027-10-01', createdAt: AT, sealedAt: null, openedAt: null, openedEarly: false, reflection: '', reflectedAt: null }] },
  'oyno.scrapbooks.v1': { guest: [{ id: 'sbresp1', title: 'Synthetic trip 3r', entries: [], createdAt: AT, updatedAt: AT }] },
};
const box = async (page: Page, testId: string) => (await page.getByTestId(testId).first().boundingBox())!;

for (const [name, size] of Object.entries(SIZES)) {
  test(`article reading width is bounded (${name})`, async ({ page, errors }) => {
    await page.setViewportSize(size);
    await seed(page, { language: 'kg', guest: true });
    await page.goto('/culture/item/boz-uy-tunduk');
    await expect(page.getByTestId('culture-item-title')).toBeVisible();
    const paragraph = await page.locator('[data-testid^="section-bookmark-"]').first().boundingBox();
    expect(paragraph!.width).toBeLessThanOrEqual(720);
    const hero = await page.getByTestId('culture-item-title').evaluate((node) => {
      let element: HTMLElement | null = node as HTMLElement;
      for (let i = 0; i < 8 && element; i++) element = element.parentElement;
      return element?.getBoundingClientRect().height ?? 0;
    });
    expect(hero).toBeLessThanOrEqual(size.height);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `e2e/.results/responsive-article-${name}.png` });
    expectNoPageErrors(errors);
  });
}

test('Creator: tools beside the canvas when there is room; resizing keeps the design, the selection and Undo', async ({ page, errors }) => {
  await page.setViewportSize(SIZES.phone);
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/oymo/create');
  await page.getByRole('button', { name: 'Place at center' }).click();
  const canvas = page.getByTestId('oymo-canvas');
  await canvas.scrollIntoViewIfNeeded();
  let frame = (await canvas.boundingBox())!;
  await page.mouse.click(frame.x + 150, frame.y + 150);
  await expect(page.getByTestId('oymo-position-x')).toHaveValue('150');
  // Phone: the motif tools are below the canvas.
  const phoneTools = await page.getByRole('button', { name: 'Motif', exact: true }).boundingBox();
  expect(phoneTools!.y).toBeGreaterThan(frame.y);

  // Rotate to a tablet in landscape: same design, same selection, Undo still there.
  await page.setViewportSize(SIZES.landscape);
  await expect(page.getByTestId('oymo-position-x')).toHaveValue('150');
  await expect(page.getByLabel('Select motif', { exact: true })).toHaveCount(1);
  await expect(page.getByLabel('Undo', { exact: true })).not.toHaveAttribute('aria-disabled', 'true');
  frame = (await canvas.boundingBox())!;
  const section = (await page.getByText('Motif', { exact: true }).first().boundingBox())!;
  expect(section.x + section.width).toBeLessThanOrEqual(frame.x); // tools column left of the canvas
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: 'e2e/.results/responsive-creator-landscape.png' });

  // And back.
  await page.setViewportSize(SIZES.phone);
  await expect(page.getByTestId('oymo-position-x')).toHaveValue('150');
  await expect(page.getByLabel('Select motif', { exact: true })).toHaveCount(1);
  expectNoPageErrors(errors);
});

test('Shelf: one column on phones, two on tablets; Home stays a centred column on wide windows', async ({ page, errors }) => {
  await page.setViewportSize(SIZES.phone);
  await seed(page, { language: 'ru', guest: true, storage: SHELF });
  await page.goto('/profile/shelf');
  await expect(page.getByTestId('shelf-item-board:bresp1')).toBeVisible();
  let a = await box(page, 'shelf-item-board:bresp1');
  let b = await box(page, 'shelf-item-capsule:tcresp1');
  expect(Math.abs(a.y - b.y)).toBeGreaterThan(20); // stacked
  await page.setViewportSize(SIZES.tablet);
  a = await box(page, 'shelf-item-board:bresp1');
  b = await box(page, 'shelf-item-capsule:tcresp1');
  expect(Math.abs(a.y - b.y)).toBeLessThan(4); // side by side
  expect(a.width).toBeLessThanOrEqual(480);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: 'e2e/.results/responsive-shelf-tablet.png' });

  await page.setViewportSize(SIZES.wide);
  await page.goto('/home');
  const primary = await box(page, 'home-primary');
  expect(primary.width).toBeLessThanOrEqual(960);
  expect(primary.x).toBeGreaterThan(200); // centred, not stuck to the left edge
  await page.screenshot({ path: 'e2e/.results/responsive-home-wide.png' });
  expectNoPageErrors(errors);
});

test('record editor: an unsaved edit survives resizing; the editor stays readable-width', async ({ page, errors }) => {
  await page.setViewportSize(SIZES.tablet);
  await seed(page, { language: 'en', guest: true, storage: SHELF });
  await page.goto('/profile/scrapbooks/sbresp1');
  const title = page.getByTestId('scrapbook-title');
  await title.fill('Synthetic trip, edited on a tablet');
  expect((await title.boundingBox())!.width).toBeLessThanOrEqual(720);
  await page.setViewportSize(SIZES.landscape);
  await expect(title).toHaveValue('Synthetic trip, edited on a tablet');
  await page.setViewportSize(SIZES.phone);
  await expect(title).toHaveValue('Synthetic trip, edited on a tablet');
  expectNoPageErrors(errors);
});

test('keyboard: Home shortcuts work at tablet size', async ({ page, errors }) => {
  await page.setViewportSize(SIZES.tablet);
  await seed(page, { language: 'en', guest: true });
  await page.goto('/home');
  await page.getByTestId('home-shortcut-oymo').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/culture\/oymo\/create/);
  expectNoPageErrors(errors);
});

for (const language of LANGUAGES) {
  test(`long ${language.toUpperCase()} text: no overflow on tablet and wide (Home, Shelf, Create, shortcuts)`, async ({ page, errors }) => {
    await seed(page, { language, guest: true, storage: SHELF });
    for (const size of [SIZES.tablet, SIZES.landscape, SIZES.wide]) {
      await page.setViewportSize(size);
      for (const route of ['/home', '/profile/shelf', '/create', '/settings/home-shortcuts']) {
        await page.goto(route);
        await page.waitForTimeout(300);
        await expectNoHorizontalOverflow(page);
        await expectNoExposedKeys(page);
      }
    }
    expectNoPageErrors(errors);
  });
}
