import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Rhythm Workshop: compose -> play/stop -> hand over (answer hidden) -> listen -> tap back -> timing-similarity feedback -> reveal. */

test('compose, hand over, repeat and get feedback', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/komuz/repeat');
  await page.getByTestId('workshop-entry').click();
  await expect(page).toHaveURL(/\/culture\/komuz\/workshop$/);
  await expect(page.getByTestId('ws-compose')).toContainText('not traditional komuz music');

  // Empty / single-note rhythms can't be handed over.
  await expect(page.getByTestId('ws-problem')).toContainText('Add some notes first');
  await expect(page.getByTestId('ws-hand-over')).toBeDisabled();
  await page.getByTestId('ws-step-0').click();
  await expect(page.getByTestId('ws-problem')).toContainText('at least 2 notes');
  await page.getByTestId('ws-clear').click();

  // An example: Walking = a note on every beat (6 notes).
  await page.getByTestId('ws-example-walk').click();
  await expect(page.getByTestId('ws-count')).toHaveText('6 of 12 notes');
  await page.getByTestId('ws-play').click();
  await expect(page.getByTestId('ws-stop')).toBeVisible();
  await page.getByTestId('ws-stop').click();
  await expect(page.getByTestId('ws-play')).toBeVisible();

  await page.getByTestId('ws-hand-over').click();
  await expect(page.getByTestId('ws-handoff')).toContainText('The rhythm stays hidden');
  await expect(page.locator('[data-testid^="ws-step-"]')).toHaveCount(0);
  await page.getByTestId('ws-player-ready').click();
  await expect(page.getByTestId('ws-light-on')).toBeVisible();
  await expect(page.getByTestId('ws-status')).toHaveText(/Your turn/, { timeout: 15_000 });
  await expect(page.locator('[data-testid^="ws-step-"]')).toHaveCount(0);

  // Tap it back: one tap per beat (85 bpm ~ 706 ms).
  const box = (await page.getByTestId('ws-pad').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let index = 0; index < 6; index += 1) {
    await page.mouse.down();
    await page.mouse.up();
    if (index < 5) await page.waitForTimeout(700);
  }
  await expect(page.getByTestId('ws-feedback')).toBeVisible();
  await expect(page.getByTestId('ws-score')).toHaveText(/\d+ of 12 points/);
  await expect(page.getByTestId('ws-feedback-note')).toContainText("isn't a judgement of musical skill");
  await page.getByTestId('ws-reveal').click();
  await expect(page.locator('[data-testid^="ws-revealed-"][data-testid$="-on"]')).toHaveCount(6);
  await page.getByTestId('ws-try-again').click();
  await expect(page.getByTestId('ws-handoff')).toBeVisible();
  await expect(page.locator('[data-testid^="ws-revealed-"]')).toHaveCount(0);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('works offline, KG/RU translated, accessible', async ({ page, context, errors }) => {
  await seed(page, { language: 'kg', guest: true });
  await page.goto('/culture/komuz/workshop');
  await expect(page.getByTestId('ws-grid')).toBeVisible();
  await context.setOffline(true);
  await page.getByTestId('ws-example-hop').click();
  await page.getByTestId('ws-hand-over').click();
  await page.getByTestId('ws-player-ready').click();
  await expect(page.getByTestId('ws-player')).toBeVisible();
  await expectNoExposedKeys(page);
  await context.setOffline(false);
  expectNoPageErrors(errors);
});

test('accessible composer, handoff and player', async ({ page, errors }) => {
  await seed(page, { language: 'ru', guest: true });
  await page.goto('/culture/komuz/workshop');
  await page.getByTestId('ws-example-echo').click();
  await expectNoSeriousViolations(page, 'workshop composer');
  await page.getByTestId('ws-hand-over').click();
  await expectNoSeriousViolations(page, 'workshop handoff');
  await page.getByTestId('ws-player-ready').click();
  await expectNoSeriousViolations(page, 'workshop player');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
