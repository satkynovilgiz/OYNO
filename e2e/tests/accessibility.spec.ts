import type { Page } from '@playwright/test';

import { expect, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/**
 * Accessibility of the main journeys on WEB (Chromium): automated axe
 * checks, keyboard operation, visible focus, modal focus, announcements,
 * control names/states and larger text. VoiceOver / TalkBack stay device
 * checks (docs/DEVICE_QA.md).
 */

const AT = '2026-10-04T10:00:00.000Z';
const hash = (key: unknown[]) => JSON.stringify(key);
const journal = (id: string, title: string, date: string) => ({ id, title, note: `${title} note`, date, photo: null, link: null, createdAt: AT, updatedAt: AT, deletedAt: null });
const round = (id: string, day: number, practice: boolean, primary: number) => ({ id, gameId: 'jaa_atuu', completedAt: `2026-10-0${day}T10:00:00.000Z`, practice, result: 'completed', primary, secondary: {} });

const STORAGE = {
  'oyno.journal.v1': [journal('e1', 'Yurt visit', '2026-09-20'), journal('e2', 'Felt day', '2026-09-27'), journal('e3', 'Komuz evening', '2026-10-01')],
  'oyno.gameRecords.v1': { guest: { recent: { jaa_atuu: [round('c', 4, false, 45), round('b', 3, true, 50), round('a', 2, false, 40)] }, best: { jaa_atuu: 40 }, sessions: { jaa_atuu: 3 }, wins: {}, official: { jaa_atuu: 2 } } },
  'oyno.offline.manifest': { entries: { 'culture_item:boz-uy-overview': { id: 'culture_item:boz-uy-overview', kind: 'culture_item', contentId: 'boz-uy-overview', queryHashes: [hash(['culture_item', 'boz-uy-overview'])], remoteImageUrls: [], downloadedAt: AT, version: 1, requestedBy: ['user'] } } },
  [`oyno.offline.query:${hash(['culture_item', 'boz-uy-overview'])}`]: { key: ['culture_item', 'boz-uy-overview'], data: { id: 'boz-uy-overview', title: 'Боз үй' }, savedAt: 1759572000000 },
};

/**
 * Serious + critical findings fail. Explained exclusion: `region` (moderate,
 * best-practice) - react-native-web renders no landmark elements for the
 * navigator; screens are reached through headings (h1 on every audited
 * screen) instead. Documented in docs/ACCESSIBILITY.md.
 */
/** The focused element shows a visible focus indicator. */
async function expectVisibleFocus(page: Page) {
  const focus = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) return null;
    const style = getComputedStyle(element);
    return { outline: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0, label: element.getAttribute('aria-label') ?? element.textContent };
  });
  expect(focus, 'something has keyboard focus').not.toBeNull();
  expect(focus!.outline, `visible focus on "${focus!.label}"`).toBe(true);
}

/** Tab until the element matching `testId` has focus (max `limit` presses). */
async function tabTo(page: Page, testId: string, limit = 40) {
  for (let i = 0; i < limit; i += 1) {
    if (await page.evaluate((id) => document.activeElement?.closest(`[data-testid="${id}"]`) !== null && document.activeElement?.closest(`[data-testid="${id}"]`) !== undefined, testId)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`could not reach ${testId} with Tab`);
}

test.beforeEach(async ({ page }) => {
  await seed(page, { language: 'en', guest: true, storage: STORAGE });
});

test('axe: no serious/critical findings on the audited screens', async ({ page, errors }) => {
  for (const [route, ready] of [
    ['/home', 'home-screen'],
    ['/learn/boz-uy', 'path-start'],
    ['/games/stats', 'game-stats-row-jaa_atuu'],
    ['/games/stats/jaa_atuu', 'stats-filter-official'],
    ['/offline', 'downloads-check'],
  ] as const) {
    await page.goto(route);
    await expect(page.getByTestId(ready)).toBeVisible();
    await expectNoSeriousViolations(page, route);
  }
  // Memory Book on web: the "phone app only" state.
  await page.goto('/journal/book');
  await expect(page.getByRole('heading', { name: 'Memory Book' })).toBeVisible();
  await expectNoSeriousViolations(page, '/journal/book');
  await page.goto('/search');
  await page.getByTestId('search-input').fill('Боз');
  await expect(page.getByTestId('search-result-culture_item-boz-uy-overview')).toBeVisible();
  await expectNoSeriousViolations(page, '/search with results');
  expectNoPageErrors(errors);
});

test('keyboard: search -> result -> article without a pointer', async ({ page }) => {
  await page.goto('/search');
  await expect(page.getByTestId('search-input')).toBeFocused(); // autoFocus
  await page.keyboard.type('Түндүк');
  await expect(page.getByTestId('search-result-culture_item-boz-uy-tunduk')).toBeVisible();
  await tabTo(page, 'search-result-culture_item-boz-uy-tunduk');
  await expectVisibleFocus(page);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-tunduk$/);
});

test('keyboard: start a learning path and change game-stat filters', async ({ page }) => {
  await page.goto('/learn/boz-uy');
  await expect(page.getByTestId('path-start')).toBeVisible();
  await tabTo(page, 'path-start');
  await expectVisibleFocus(page);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-overview\?fromPath=boz-uy/);

  await page.goto('/games/stats/jaa_atuu');
  const official = page.getByTestId('stats-filter-official');
  const practice = page.getByTestId('stats-filter-practice');
  await expect(official).toHaveAttribute('aria-selected', 'true');
  await expect(practice).toHaveAttribute('aria-selected', 'false');
  await tabTo(page, 'stats-filter-practice');
  await expectVisibleFocus(page);
  await page.keyboard.press('Enter');
  await expect(practice).toHaveAttribute('aria-selected', 'true');
  await expect(official).toHaveAttribute('aria-selected', 'false');
  // The chart keeps a text alternative with the actual values.
  await page.getByTestId('stats-filter-official').click();
  await expect(page.getByRole('img', { name: /Last 2 official rounds: 40, 45/ })).toBeVisible();
});

test('modal: focus moves in, stays in, Escape closes, focus returns; dialog is named', async ({ page }) => {
  await page.goto('/offline');
  const trigger = page.getByRole('button', { name: 'Remove all', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: /remove all/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading')).toBeVisible();
  // Focus starts on Cancel (the safe action) and Tab never leaves the dialog.
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
  await expectNoSeriousViolations(page, 'remove-all dialog');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  // Nothing was removed.
  await expect(page.getByTestId('downloads-check')).toBeVisible();
});

test('announcements: download check result reaches the live region', async ({ page }) => {
  await page.goto('/offline');
  const region = page.locator('#oyno-live-region');
  await expect(region).toHaveAttribute('aria-live', 'polite');
  await page.getByTestId('downloads-check').click();
  await expect(page.getByTestId('downloads-check-result')).toBeVisible();
  await expect(region).toHaveText(/1 ready offline/);
});

// Memory Book PDF creation is phone-only (web shows an explanation), so its
// selection checkboxes are a device check; here: disabled state on web.
test('states: a disabled control says so (offline path download retry)', async ({ page, context }) => {
  await page.goto('/learn/boz-uy');
  // One step is already saved (STORAGE) -> the path offers "Retry download".
  const download = page.getByRole('button', { name: 'Retry download' });
  await expect(download).toBeVisible();
  await expect(download).not.toHaveAttribute('aria-disabled', 'true');
  await context.setOffline(true);
  await expect(download).toHaveAttribute('aria-disabled', 'true');
  await context.setOffline(false);
});

test.describe('larger text keeps primary actions reachable', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  test('Reader XL + Larger controls at 320 px: Downloads, Search, Path', async ({ page, errors }) => {
    await seed(page, {
      language: 'ru',
      guest: true,
      storage: { ...STORAGE, 'oyno.readerSettings.v1': { textSize: 'xl', lineSpacing: 'spacious', focusMode: false }, 'oyno.comfort.v1': { reduceMotion: true, haptics: 'standard', largerControls: true, highContrast: false } },
    });
    for (const [route, action] of [
      ['/offline', 'downloads-check'],
      ['/learn/boz-uy', 'path-start'],
      ['/search', 'search-input'],
    ] as const) {
      await page.goto(route);
      const control = page.getByTestId(action);
      await control.scrollIntoViewIfNeeded();
      await expect(control, `${action} on ${route}`).toBeInViewport();
      const box = await control.boundingBox();
      expect(box!.width, `${action} not squeezed`).toBeGreaterThan(80);
      await expectNoHorizontalOverflow(page);
    }
    expectNoPageErrors(errors);
  });
});
