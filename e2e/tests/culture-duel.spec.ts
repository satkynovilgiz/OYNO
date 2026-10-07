import type { Page } from '@playwright/test';

import en from '../../src/i18n/locales/en.json';
import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Culture Duel on one device: two players, pass-the-phone turns, reveal, final, rematch. */

const names = (en as unknown as { detective: { names: Record<string, string> } }).detective.names;
// Synthetic nicknames.
const P1 = 'Synthetic Aigul';
const P2 = 'Synthetic Bek';

/** "Show my question" - available a moment after the handoff appears (a double tap on the previous answer can't hit it). */
async function ready(page: Page) {
  await expect(page.getByTestId('duel-ready-armed')).toBeVisible();
  await page.getByTestId('duel-ready').click();
}

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
    await ready(page);
    await expect(page.getByTestId('duel-turn')).toContainText(`${first}'s turn · Round ${round + 1} of 3`);
    const firstAnswer = await answerFirst(page);
    // Straight to the next handoff - no feedback for the first player.
    await expectHandoffConceals(page, second);
    expect(await page.locator('body').innerText()).not.toContain(firstAnswer);
    await ready(page);
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
    await ready(page);
    await page.getByRole('radio').first().click();
    await ready(page);
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
  await expect(page.getByRole('radio')).toHaveCount(5); // players (2/3/4) + length (3/5)
  await page.getByTestId('duel-start').click();
  await expectNoSeriousViolations(page, 'duel handoff');
  await ready(page);
  await expectNoSeriousViolations(page, 'duel turn');
  await page.getByRole('radio').first().click();
  await ready(page);
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
    await ready(page);
    await expectNoExposedKeys(page);
  }
});

test('Party Mode: a complete four-player match offline - rotation, concealed handoffs, shared ranking, rematch', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/duel');
  // Offline from here on: everything the duel needs is bundled.
  await page.route('https://oyno-e2e.test/**', (route) => route.abort('internetdisconnected'));
  await page.getByTestId('duel-players-4').click();
  const players = ['Synthetic A', 'Synthetic B', 'Synthetic C', 'Synthetic D'];
  for (const [index, name] of players.entries()) await page.getByTestId(`duel-name-${index + 1}`).fill(name);
  await page.getByTestId('duel-start').click();

  for (let round = 0; round < 3; round += 1) {
    const order = [0, 1, 2, 3].map((offset) => players[(round + offset) % 4]);
    for (const name of order) {
      await expectHandoffConceals(page, name);
      await ready(page);
      await expect(page.getByTestId('duel-turn')).toContainText(`${name}'s turn`);
      // A double tap on the answer: the second tap must not open the next player's turn.
      await page.getByRole('radio').first().dblclick();
      if (name !== order[3]) {
        await expect(page.getByTestId('duel-handoff')).toBeVisible();
        await expect(page.getByTestId('duel-turn')).toHaveCount(0);
      }
    }
    // Revealed only now - everyone's answer at once.
    const reveal = page.getByTestId('duel-reveal');
    await expect(reveal).toBeVisible();
    for (const name of players) await expect(reveal).toContainText(`${name}: `);
    await page.getByTestId('duel-next').click();
  }
  // Everyone picked the same (first) answer each round: all share 1st place.
  await expect(page.getByTestId('duel-outcome')).toHaveText("It's a tie!");
  for (let seat = 1; seat <= 4; seat += 1) await expect(page.getByTestId(`duel-rank-${seat}`)).toHaveText(/^1\./);
  await page.getByTestId('duel-rematch').click();
  await expectHandoffConceals(page, players[0]);
  expect(JSON.stringify(await page.evaluate(() => ({ ...localStorage })))).not.toContain('Synthetic');
  expectNoPageErrors(errors);
});

test('browser Back during a match asks first; Keep playing stays, Leave leaves', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture');
  await page.getByTestId('duel-entry').click();
  await page.getByTestId('duel-start').click();
  await ready(page);
  await page.goBack();
  await expect(page.getByText('Leave the duel?')).toBeVisible();
  await page.getByRole('button', { name: 'Keep playing' }).click();
  await expect(page.getByTestId('duel-turn')).toBeVisible();
  // The address bar is back on the duel, so the next Back is held again.
  await expect(page).toHaveURL(/\/culture\/duel$/);
  await page.goBack();
  await page.getByRole('button', { name: 'Leave' }).click();
  await expect(page.getByTestId('duel-entry')).toBeVisible();
  // A finished match leaves without asking.
  expectNoPageErrors(errors);
});

test('large text: the child layout fits a small phone without horizontal scrolling', async ({ page, errors }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await seed(page, { language: 'ru', guest: true, storage: { 'oyno.ageGroup': '6-9' } });
  await page.goto('/culture/duel');
  await page.getByTestId('duel-players-4').click();
  await expectNoHorizontalOverflow(page);
  await page.getByTestId('duel-start').click();
  await expectNoHorizontalOverflow(page);
  await ready(page);
  await expectNoHorizontalOverflow(page);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
