import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Boz üy: the guided builder still works, then Build from Memory end to end. */

const ORDER = ['kerege', 'uuk', 'tunduk', 'bosogo'];

test('the guided builder is unchanged: four steps, then completion with the memory challenge offered', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/boz-uy/build');
  for (const name of ['Kerege', 'Uuk', 'Tunduk', 'Bosogo']) {
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Next step' }).click();
  }
  await expect(page.getByText('Boz üy built!')).toBeVisible();
  await expect(page.getByTestId('memory-entry-done')).toBeVisible();
  expectNoPageErrors(errors);
});

test('a complete challenge: wrong choice explained, a hint, source link keeps the attempt, final review', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/boz-uy/build');
  await page.getByTestId('memory-entry').click();
  await expect(page).toHaveURL(/\/culture\/boz-uy\/memory$/);
  await expect(page.getByTestId('memory-intro')).toContainText("the guided builder's own text");
  await page.getByTestId('memory-mode-challenge').click();
  await page.getByTestId('memory-start').click();

  // A wrong first pick, explained with that part's own tip.
  await page.getByTestId('memory-choice-tunduk').click();
  await expect(page.getByTestId('memory-wrong')).toContainText('Not yet: Tunduk.');
  await expect(page.getByTestId('memory-wrong')).toContainText('fitted into it');
  await page.getByTestId('memory-choice-kerege').click();
  await expect(page.getByTestId('memory-placed-0')).toContainText('Kerege');

  // A hint for step 2, then read the source and come back to the same attempt.
  await page.getByTestId('memory-hint-button').click();
  await expect(page.getByTestId('memory-hint')).toContainText('pointed end');
  await page.getByTestId('memory-read').click();
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-overview$/);
  await page.goBack();
  await expect(page.getByTestId('memory-progress')).toContainText('Step 2 of 4');
  await expect(page.getByTestId('memory-hint')).toBeVisible();

  for (const part of ORDER.slice(1)) await page.getByTestId(`memory-choice-${part}`).click();
  await expect(page.getByTestId('memory-done')).toBeVisible();
  await expect(page.getByTestId('memory-review-0')).toContainText('tried first: Tunduk');
  await expect(page.getByTestId('memory-review-1')).toContainText('needed a hint');
  await expect(page.getByTestId('memory-review-2')).toContainText('first time');
  await expect(page.getByTestId('memory-summary')).toHaveText('Placed first time, without a hint: 2 of 4');
  await expect(page.getByText('not a measure of real-world building skill')).toBeVisible();
  // No XP / progress was written for it.
  expect(await page.evaluate(() => localStorage.getItem('oyno.progress.v1'))).toBeNull();
  await page.getByTestId('memory-restart').click();
  await expect(page.getByTestId('memory-progress')).toContainText('Step 1 of 4');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('works offline; KG/RU translated; accessible', async ({ page, context, errors }) => {
  await seed(page, { language: 'kg', guest: true });
  await page.goto('/culture/boz-uy/memory');
  await expect(page.getByTestId('memory-intro')).toBeVisible();
  await context.setOffline(true);
  await page.getByTestId('memory-start').click();
  await page.getByTestId('memory-choice-kerege').click();
  await expect(page.getByTestId('memory-placed-0')).toBeVisible();
  await expectNoExposedKeys(page);
  await context.setOffline(false);
  expectNoPageErrors(errors);
});

test('accessible intro, play and review', async ({ page, errors }) => {
  await seed(page, { language: 'ru', guest: true });
  await page.goto('/culture/boz-uy/memory');
  await expectNoSeriousViolations(page, 'memory intro');
  await page.getByTestId('memory-start').click();
  await page.getByTestId('memory-choice-uuk').click();
  await expectNoSeriousViolations(page, 'memory play');
  for (const part of ORDER) await page.getByTestId(`memory-choice-${part}`).click();
  await expectNoSeriousViolations(page, 'memory review');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
