import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, seed, test, waitForStored } from '../helpers';

/** Repeat the Rhythm: entry, a full five-round session (sound off), summary, saved apart from game records. */

async function playRound(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('repeat-status')).toHaveText(/Your turn/, { timeout: 10_000 });
  const notes = await page.getByTestId('repeat-lights').locator(':scope > div').count();
  const box = (await page.getByTestId('repeat-pad').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let index = 0; index < notes; index += 1) {
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(450);
  }
  await expect(page.getByTestId('repeat-feedback')).toBeVisible();
  await expect(page.getByTestId('repeat-round-points')).toHaveText(/\d+ of \d+ points/);
}

test('a full session from the Listening Room: example, tapping, feedback, summary', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/komuz/listen');
  await page.getByTestId('repeat-entry').click();
  await expect(page).toHaveURL(/\/culture\/komuz\/repeat/);
  await expect(page.getByTestId('repeat-exercises-note')).toContainText('not traditional komuz rhythms');
  await page.getByTestId('repeat-level-easy').click();
  await page.getByRole('switch').click(); // practise in silence
  await page.getByTestId('repeat-start').click();

  for (let round = 1; round <= 5; round += 1) {
    await expect(page.getByTestId('repeat-progress')).toHaveText(`Round ${round} of 5`);
    // The visual demonstration lights each note.
    await expect(page.getByTestId('repeat-light-on')).toBeVisible();
    await playRound(page);
    if (round === 1) {
      await page.getByTestId('repeat-replay').click();
      await expect(page.getByTestId('repeat-status')).toHaveText('Listen and watch');
      await expect(page.getByTestId('repeat-feedback')).toBeVisible(); // the result stays
    }
    await page.getByTestId('repeat-next').click();
  }
  await expect(page.getByTestId('repeat-summary')).toBeVisible();
  await expect(page.getByTestId('repeat-summary-points')).toHaveText(/\d+ of \d+ points/);
  await waitForStored<Record<string, { easy?: { sessions: number } }>>(page, 'oyno.rhythmRepeat.v1', (value) => value?.guest?.easy?.sessions === 1, 'the session is recorded once');
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('oyno.gameRecords.v1'))) ?? '{}')).toEqual({});
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('leaving mid-example goes back cleanly; the trainer offers the mode', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/komuz/rhythm');
  await page.getByTestId('rhythm-repeat-mode').click();
  await page.getByTestId('repeat-start').click();
  await expect(page.getByTestId('repeat-progress')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).first().click();
  await expect(page).toHaveURL(/\/culture\/komuz\/rhythm$/);
  expectNoPageErrors(errors);
});

test('KG and RU are translated', async ({ page, errors }) => {
  for (const language of ['kg', 'ru'] as const) {
    await seed(page, { language, guest: true });
    await page.goto('/culture/komuz/repeat');
    await page.getByTestId('repeat-start').click();
    await expect(page.getByTestId('repeat-progress')).toBeVisible();
    await expectNoExposedKeys(page);
  }
  expectNoPageErrors(errors);
});

test('accessible setup and round', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/komuz/repeat');
  await expectNoSeriousViolations(page, 'repeat setup');
  await page.getByTestId('repeat-start').click();
  await expect(page.getByTestId('repeat-status')).toHaveText(/Your turn/, { timeout: 10_000 });
  await expectNoSeriousViolations(page, 'repeat round');
  expectNoPageErrors(errors);
});
