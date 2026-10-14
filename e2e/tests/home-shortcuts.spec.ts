import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, readStored, seed, test } from '../helpers';
import type { Page } from '@playwright/test';

/** Home shortcuts: up to four pins from the activity catalogue, per owner, reorderable, resettable, robust to bad data and failed writes. */
const KEY = 'oyno.homeShortcuts.v1';
const order = (page: Page) => page.locator('[data-testid^="home-shortcut-"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')!.replace('home-shortcut-', '')));

test('every default shortcut opens its destination', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  const expected: [string, RegExp][] = [
    ['daily', /\/daily$/],
    ['jaaAtuu', /\/games\/jaa-atuu$/],
    ['oymo', /\/culture\/oymo\/create$/],
    ['komuzListen', /\/culture\/komuz\/listen$/],
  ];
  await page.goto('/home');
  await expect(page.getByTestId('home-shortcuts')).toContainText('Your shortcuts');
  expect(await order(page)).toEqual(expected.map(([id]) => id));
  for (const [id, url] of expected) {
    await page.goto('/home');
    await page.getByTestId(`home-shortcut-${id}`).click();
    await expect(page).toHaveURL(url);
  }
  expectNoPageErrors(errors);
});

test('edit: remove, add, reorder with buttons -> Home follows and it survives a reload; reset asks first', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await seed(page, { language: 'en', guest: true });
  await page.goto('/home');
  await page.getByTestId('home-shortcuts-edit').click();
  await expect(page).toHaveURL(/\/settings\/home-shortcuts/);
  await expect(page.getByTestId('home-shortcuts-screen')).toContainText('Pinned: 4 of 4');
  await expect(page.getByTestId('shortcut-add-duel')).toHaveAttribute('aria-disabled', 'true'); // full
  await page.getByTestId('shortcut-remove-jaaAtuu').click();
  await expect(page.getByTestId('home-shortcuts-screen')).toContainText('Pinned: 3 of 4');
  await page.getByTestId('shortcut-add-duel').click();
  await page.getByTestId('shortcut-up-duel').click();
  await page.getByTestId('shortcut-up-duel').click();
  await expect(page.getByTestId('shortcuts-pinned')).toContainText('2. Culture Duel');
  await expectNoSeriousViolations(page, 'shortcut editor');
  await page.screenshot({ path: 'e2e/.results/shortcuts-editor.png', fullPage: true });

  await page.goto('/home');
  expect(await order(page)).toEqual(['daily', 'duel', 'oymo', 'komuzListen']);
  await page.reload();
  await expect(page.getByTestId('home-shortcut-duel')).toBeVisible();
  expect(await order(page)).toEqual(['daily', 'duel', 'oymo', 'komuzListen']);
  expect(await readStored(page, KEY)).toEqual({ guest: { pins: ['daily', 'duel', 'oymo', 'komuzListen'] } });

  // Reset: cancel keeps them; confirm restores the default four.
  await page.goto('/settings/home-shortcuts');
  await page.getByTestId('shortcuts-reset').click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId('shortcut-pinned-duel')).toBeVisible();
  await page.getByTestId('shortcuts-reset').click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByTestId('shortcut-pinned-jaaAtuu')).toBeVisible();
  await expect(page.getByTestId('shortcut-pinned-duel')).toHaveCount(0);
  expect(await readStored(page, KEY)).toEqual({});
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('another owner keeps their own shortcuts; a removed destination is reported, not shown', async ({ page, errors }) => {
  await seed(page, { language: 'ru', guest: true, storage: { [KEY]: { 'user-x': { pins: ['duel', 'restore'] }, guest: { pins: ['retiredActivity', 'oymo'] } } } });
  await page.goto('/home');
  await expect(page.getByTestId('home-shortcut-oymo')).toBeVisible();
  expect(await order(page)).toEqual(['oymo']);
  await expect(page.getByTestId('home-shortcuts-unavailable')).toContainText('1 ярлык больше недоступен');
  await page.getByTestId('home-shortcuts-edit').click();
  await page.getByTestId('shortcuts-remove-unavailable').click();
  await expect(page.getByTestId('shortcuts-unavailable')).toHaveCount(0);
  // The other owner's shortcuts are untouched.
  expect(await readStored(page, KEY)).toEqual({ 'user-x': { pins: ['duel', 'restore'] }, guest: { pins: ['oymo'] } });
  expectNoPageErrors(errors);
});

test('a failed write leaves the shortcuts as they were and says so', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.addInitScript((key) => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name: string, value: string) {
      if (name === key) throw new Error('quota');
      return real.call(this, name, value);
    };
  }, KEY);
  await page.goto('/settings/home-shortcuts');
  await page.getByTestId('shortcut-remove-oymo').click();
  await expect(page.getByTestId('shortcuts-failed')).toContainText('Your shortcuts are unchanged');
  await expect(page.getByTestId('shortcut-pinned-oymo')).toBeVisible();
  expect(await readStored(page, KEY)).toBeNull();
  expectNoPageErrors(errors);
});

test('unreadable shortcuts: Home still works and offers Retry', async ({ page, errors }) => {
  await seed(page, { language: 'kg', guest: true, storage: { [KEY]: '{broken' } });
  await page.goto('/home');
  await expect(page.getByTestId('home-primary-discover')).toBeVisible();
  await expect(page.getByTestId('home-shortcuts-error')).toBeVisible();
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ guest: { pins: ['duel'] } })), KEY);
  await page.getByTestId('home-shortcuts-error-retry').click();
  await expect(page.getByTestId('home-shortcut-duel')).toBeVisible();
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
