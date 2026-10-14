import { expect, expectNoPageErrors, readStored, seed, test } from '../helpers';
import type { Page } from '@playwright/test';

/** Interaction feedback (docs/INTERACTION_FEEDBACK.md): real save results, rapid input, keyboard focus, Reduce Motion. */
const KEY = 'oyno.homeShortcuts.v1';
const focused = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null);
const pinned = (page: Page) => page.locator('[data-testid^="shortcut-pinned-"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')!.replace('shortcut-pinned-', '')));

test('keyboard reorder keeps focus on the control; "Saved" appears only after the write succeeded', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/settings/home-shortcuts');
  await expect(page.getByTestId('shortcuts-idle')).toBeAttached();
  await page.getByTestId('shortcut-down-daily').focus();
  for (let step = 0; step < 3; step++) {
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('shortcuts-saved')).toBeVisible();
    expect(await focused(page)).toBe('shortcut-down-daily');
  }
  expect(await pinned(page)).toEqual(['jaaAtuu', 'oymo', 'komuzListen', 'daily']);
  // At the bottom the control is unavailable but keeps focus (no jump to the page top).
  await expect(page.getByTestId('shortcut-down-daily')).toHaveAttribute('aria-disabled', 'true');
  expect(await focused(page)).toBe('shortcut-down-daily');
  expect(await readStored(page, KEY)).toEqual({ guest: { pins: ['jaaAtuu', 'oymo', 'komuzListen', 'daily'] } });
  // The confirmation fades back on its own.
  await expect(page.getByTestId('shortcuts-saved')).toHaveCount(0, { timeout: 6000 });
  expectNoPageErrors(errors);
});

test('rapid presses: no stuck "Saving", the final order matches storage', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/settings/home-shortcuts');
  const down = page.getByTestId('shortcut-down-daily');
  await expect(down).toBeVisible();
  await Promise.all([down.click(), down.click(), down.click(), down.click({ delay: 5 })]);
  await expect(page.getByTestId('shortcuts-saving')).toHaveCount(0);
  const shown = await pinned(page);
  const stored = (await readStored<Record<string, { pins: string[] }>>(page, KEY))?.guest?.pins;
  expect(shown).toEqual(stored);
  expect(shown).toContain('daily');
  expect(new Set(shown).size).toBe(4);
  expectNoPageErrors(errors);
});

test('Reduce Motion: everything still works, with the same states', async ({ page, errors }) => {
  await seed(page, { language: 'kg', guest: true, storage: { 'oyno.comfort.v1': { reduceMotion: true, haptics: 'off', largerControls: true, highContrast: false } } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/settings/home-shortcuts');
  await page.getByTestId('shortcut-remove-oymo').click();
  await expect(page.getByTestId('shortcuts-saved')).toContainText('Сакталды');
  await page.getByTestId('shortcut-add-restore').click();
  await expect(page.getByTestId('shortcut-pinned-restore')).toBeVisible();
  await page.goto('/home');
  await expect(page.getByTestId('home-shortcut-restore')).toBeVisible();
  expectNoPageErrors(errors);
});
