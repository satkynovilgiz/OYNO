import type { Page } from '@playwright/test';

import en from '../../src/i18n/locales/en.json';
import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Culture Duel on one device: two players, pass-the-phone turns, reveal, final, rematch. */

const names = (en as unknown as { detective: { names: Record<string, string> } }).detective.names;
// Synthetic nicknames.
const P1 = 'Synthetic Aigul';
const P2 = 'Synthetic Bek';

/** Answers the current turn with the FIRST option and returns its label. */
async function answerFirst(page: Page): Promise<string> {
  const option = page.getByRole('radio').first();
  const label = (await option.innerText()).trim();
  await option.click();
  return label;
}

async function expectHandoffConceals(page: Page, player: string) {
  const handoff = page.getByTestId('duel-handoff');
  await expect(handoff).toContainText(`Pass the phone to ${player}`);
  // No question, no answers, no "correct" - nothing to glimpse.
  await expect(page.getByRole('radio')).toHaveCount(0);
  const text = await page.locator('body').innerText();
  for (const name of Object.values(names)) expect(text).not.toContain(name);
  expect(text).not.toMatch(/It is:|correct|Both answered/);
}

test('two people play a short match: handoffs conceal answers, both answers are revealed together, then rematch', async ({ page, errors }) => {
  const sent: string[] = [];
  page.on('request', (request) => sent.push(`${request.url()} ${request.postData() ?? ''}`));
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture');
  await page.getByTestId('duel-entry').click();
  await expect(page.getByTestId('duel-rules')).toContainText('1 point for each correct answer');
  await page.getByTestId('duel-name-1').fill(P1);
  await page.getByTestId('duel-name-2').fill(P2);
  await page.getByTestId('duel-length-3').click();
  await page.getByTestId('duel-start').click();

  const order = [
    [P1, P2],
    [P2, P1],
    [P1, P2],
  ];
  for (let round = 0; round < 3; round += 1) {
    const [first, second] = order[round];
    await expectHandoffConceals(page, first);
    await page.getByTestId('duel-ready').click();
    await expect(page.getByTestId('duel-turn')).toContainText(`${first}'s turn · Round ${round + 1} of 3`);
    const firstAnswer = await answerFirst(page);
    // Straight to the next handoff - no feedback for the first player.
    await expectHandoffConceals(page, second);
    expect(await page.locator('body').innerText()).not.toContain(firstAnswer);
    await page.getByTestId('duel-ready').click();
    await answerFirst(page);
    // Now both answers are shown together, with the correct one.
    const reveal = page.getByTestId('duel-reveal');
    await expect(reveal).toBeVisible();
    await expect(page.getByTestId('duel-correct')).toHaveText(/^It is: /);
    await expect(reveal).toContainText(`${first}: ${firstAnswer}`);
    await page.getByTestId('duel-next').click();
  }

  // Both always picked the first option of the SAME list: same answers -> a tie.
  await expect(page.getByTestId('duel-outcome')).toHaveText("It's a tie!");
  await expect(page.getByTestId('duel-final-score')).toHaveText(new RegExp(`^${P1} (\\d) - \\1 ${P2}$`));

  await page.getByTestId('duel-rematch').click();
  await expectHandoffConceals(page, P1);
  await expect(page.getByTestId('duel-handoff')).toContainText('Round 1 of 3');

  // Nicknames never leave the match: not stored, not in any request.
  expect(JSON.stringify(await page.evaluate(() => ({ ...localStorage })))).not.toContain('Synthetic');
  expect(sent.join('\n')).not.toContain('Synthetic');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('a long match can be won; leaving mid-match asks first', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/duel');
  await page.getByTestId('duel-length-5').click();
  await page.getByTestId('duel-start').click();
  for (let round = 0; round < 5; round += 1) {
    // The players pick different answers (first vs last option), so the scores can differ.
    await page.getByTestId('duel-ready').click();
    await page.getByRole('radio').first().click();
    await page.getByTestId('duel-ready').click();
    await page.getByRole('radio').last().click();
    await expect(page.getByTestId('duel-reveal')).toBeVisible();
    await page.getByTestId('duel-next').click();
  }
  await expect(page.getByTestId('duel-outcome')).toHaveText(/wins!|tie/);
  await expect(page.getByTestId('duel-final-score')).toHaveText(/^Player 1 \d - \d Player 2$/);

  await page.getByTestId('duel-new-players').click();
  await page.getByTestId('duel-start').click();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByText('Leave the duel?')).toBeVisible();
  await page.getByRole('button', { name: 'Keep playing' }).click();
  await expect(page.getByTestId('duel-handoff')).toBeVisible();
  expectNoPageErrors(errors);
});

test('accessible and translated: setup, handoff, turn, reveal (KG and RU too)', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/duel');
  await expectNoSeriousViolations(page, 'duel setup');
  await expect(page.getByRole('radio')).toHaveCount(2);
  await page.getByTestId('duel-start').click();
  await expectNoSeriousViolations(page, 'duel handoff');
  await page.getByTestId('duel-ready').click();
  await expectNoSeriousViolations(page, 'duel turn');
  await page.getByRole('radio').first().click();
  await page.getByTestId('duel-ready').click();
  await page.getByRole('radio').first().click();
  await expectNoSeriousViolations(page, 'duel reveal');
  expectNoPageErrors(errors);

  for (const language of ['kg', 'ru'] as const) {
    await seed(page, { language, guest: true });
    await page.evaluate((lang) => {
      localStorage.setItem('oyno.language', lang);
      sessionStorage.clear();
    }, language);
    await page.goto('/culture/duel');
    await page.getByTestId('duel-start').click();
    await page.getByTestId('duel-ready').click();
    await expectNoExposedKeys(page);
  }
});
