import type { Page } from '@playwright/test';

import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/**
 * Pattern Detective: a wrong answer, a correction, completion and the
 * explanation. The challenge is random, so the test reads the ACCESSIBLE
 * LIST (original vs changed copy per cell) - the same information a
 * screen-reader user gets - to know which rows changed.
 */
async function rows(page: Page) {
  const list = page.locator('[data-testid^="detective-row-"]');
  const count = await list.count();
  const out: { id: string; changed: boolean }[] = [];
  for (let index = 0; index < count; index += 1) {
    const row = list.nth(index);
    const text = (await row.innerText()).trim();
    const match = / - [^:]+: (.*); [^:]+: (.*)$/.exec(text); // "<where> - <Original>: X; <Changed copy>: Y" in any language
    out.push({ id: (await row.getAttribute('data-testid'))!, changed: !!match && match[1] !== match[2] });
  }
  return out;
}

for (const width of [320, 412]) {
  test(`medium: wrong -> corrected -> found, with explanation at ${width}px`, async ({ page, errors }) => {
    await page.setViewportSize({ width, height: 860 });
    await seed(page, { language: 'en', guest: true });
    await page.goto('/culture/oymo/create');
    await page.getByTestId('detective-entry').click();
    await expect(page.getByTestId('detective-setup')).toContainText('no scores');
    await page.getByTestId('remember-detective-level-medium').click();
    await page.getByTestId('detective-start').click();
    await expect(page.getByTestId('detective-play')).toContainText('Find the 2 changed squares.');
    await expectNoHorizontalOverflow(page);

    const all = await rows(page);
    const changed = all.filter((row) => row.changed);
    const unchanged = all.filter((row) => !row.changed);
    expect(changed.length).toBeGreaterThanOrEqual(1); // 2 changed squares; both are drawn in at least one version
    expect(unchanged.length).toBeGreaterThanOrEqual(1);

    // Wrong: one unchanged square marked.
    await page.getByTestId(unchanged[0].id).click();
    await page.getByTestId('detective-check').click();
    await expect(page.getByTestId('detective-feedback')).toContainText('0 of 2 found');
    await expect(page.getByTestId('detective-feedback')).toContainText("1 marked square hasn't changed.");

    // A hint, then the correction (via the list and the grid).
    await page.getByTestId('detective-hint').click();
    await expect(page.getByTestId('detective-hints')).toContainText('One change is in row');
    await page.getByTestId(unchanged[0].id).click();
    for (const row of changed) {
      const [, col, line] = /detective-row-(\d)-(\d)/.exec(row.id)!;
      await page.getByTestId(`detective-modified-cell-${col}-${line}`).click();
    }
    await expect(page.getByTestId('detective-marked')).toContainText(`${changed.length} marked`);
    await page.getByTestId('detective-check').click();
    await expect(page.getByTestId('detective-done')).toContainText('You found every change!');
    await expect(page.getByTestId('detective-assisted')).toHaveText('With help: you used a hint.');
    await expect(page.getByTestId('detective-explanation')).toContainText('What changed');
    await expectNoSeriousViolations(page, 'detective done');

    await page.getByTestId('detective-open-modified').click();
    await expect(page).toHaveURL(/\/culture\/oymo\/create$/);
    await expect(page.getByTestId('oymo-handoff-note')).toContainText('unsaved copy of a Pattern Detective pattern');
    await expectNoExposedKeys(page);
    expectNoPageErrors(errors);
  });
}

test('offline, RU, reduced motion: plays and checks', async ({ page, context, errors }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, { language: 'ru', guest: true });
  await page.goto('/culture/oymo/pattern-detective');
  await context.setOffline(true);
  await page.getByTestId('detective-start').click();
  const changed = (await rows(page)).filter((row) => row.changed);
  for (const row of changed) await page.getByTestId(row.id).click();
  await page.getByTestId('detective-check').click();
  await expect(page.getByTestId('detective-done')).toContainText('Вы нашли все изменения!');
  await expect(page.getByTestId('detective-assisted')).toHaveText('Найдено без подсказок.');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
