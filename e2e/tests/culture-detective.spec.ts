import en from '../../src/i18n/locales/en.json';
import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, seed, test, waitForStored } from '../helpers';

/** Culture Detective: a full session, results, replay and the focus round - offline content only. */

const names = (en as unknown as { detective: { names: Record<string, string> } }).detective.names;
const idByName = Object.fromEntries(Object.entries(names).map(([id, name]) => [name, id]));

test('a complete session: clues, answers, explanations with the right source, results, replay', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture');
  await page.getByTestId('detective-entry').click();
  await expect(page).toHaveURL(/\/culture\/detective/);
  await page.getByTestId('detective-start').click();

  const seen: string[] = [];
  for (let index = 1; index <= 5; index += 1) {
    await expect(page.getByTestId('detective-progress')).toHaveText(`Object ${index} of 5`);
    await expect(page.getByTestId('detective-artwork')).toBeVisible();
    // Reveal one clue, then answer (the FIRST option - right or wrong, both are fine).
    await page.getByTestId('detective-reveal').click();
    await expect(page.getByTestId('detective-clue-1')).toBeVisible();
    await page.getByRole('radio').first().click();
    const feedback = page.getByTestId('detective-feedback');
    await expect(feedback).toBeVisible();
    const answer = (await feedback.getByText(/^It is: /).innerText()).replace('It is: ', '');
    seen.push(idByName[answer]);

    if (index === 1) {
      // The explanation opens the source article of THIS object.
      await page.getByTestId('detective-read-article').click();
      await expect(page).toHaveURL(new RegExp(`/culture/item/${idByName[answer]}$`));
      await page.goBack();
      // Coming back resumes the session where it was (still answered).
      await expect(page.getByTestId('detective-feedback')).toBeVisible();
    }
    await page.getByTestId('detective-next').click();
  }
  // No repeats within the session.
  expect(new Set(seen).size).toBe(5);

  await expect(page.getByTestId('detective-results')).toBeVisible();
  await expect(page.getByTestId('detective-score')).toHaveText(/Score: \d+ of 20/);
  await waitForStored<Record<string, { sessions: number }>>(page, 'oyno.detective.v1', (value) => value?.guest?.sessions === 1, 'the session is recorded once');
  // Official game records are untouched (another screen may store an empty object there).
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('oyno.gameRecords.v1'))) ?? '{}')).toEqual({});

  await page.getByTestId('detective-replay').click();
  await expect(page.getByTestId('detective-progress')).toHaveText('Object 1 of 5');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('the focus round asks only the missed questions', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.detective.v1': { guest: { bestScore: 9, sessions: 1, lastMissedIds: ['tunduk', 'shyrdak'], lastPlayedAt: '2026-10-05T10:00:00.000Z' } } } });
  await page.goto('/culture/detective');
  await expect(page.getByText('Your best: 9')).toBeVisible();
  await page.getByTestId('detective-focus').click();
  const asked: string[] = [];
  for (let index = 1; index <= 2; index += 1) {
    await expect(page.getByTestId('detective-progress')).toHaveText(`Object ${index} of 2`);
    await page.getByRole('radio').first().click();
    asked.push(idByName[(await page.getByTestId('detective-feedback').getByText(/^It is: /).innerText()).replace('It is: ', '')]);
    await page.getByTestId('detective-next').click();
  }
  expect(asked.sort()).toEqual(['boz-uy-tunduk', 'shyrdak-craft']);
  await expect(page.getByTestId('detective-results')).toBeVisible();
  expectNoPageErrors(errors);
});

test('Kyrgyz and Russian sessions are fully translated', async ({ page, errors }) => {
  for (const language of ['kg', 'ru'] as const) {
    await page.context().clearCookies();
    await seed(page, { language, guest: true });
    await page.goto('/culture/detective');
    await page.getByTestId('detective-start').click();
    await page.getByTestId('detective-reveal').click();
    await page.getByRole('radio').first().click();
    await expect(page.getByTestId('detective-feedback')).toBeVisible();
    await expectNoExposedKeys(page);
  }
  expectNoPageErrors(errors);
});

test('accessible: intro, a question with clues and feedback, results', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/detective');
  await expectNoSeriousViolations(page, 'detective intro');
  await page.getByTestId('detective-start').click();
  await page.getByTestId('detective-reveal').click();
  await expectNoSeriousViolations(page, 'detective question');
  // Answers are a radio group with names; the picture's label does not give the answer away.
  await expect(page.getByRole('radio')).toHaveCount(4);
  const label = await page.getByTestId('detective-artwork').getAttribute('aria-label');
  for (const name of Object.values(names)) expect(label).not.toContain(name);
  await page.getByRole('radio').first().click();
  await expectNoSeriousViolations(page, 'detective feedback');
  for (let index = 1; index <= 5; index += 1) {
    if (index > 1) await page.getByRole('radio').first().click();
    await page.getByTestId('detective-next').click();
  }
  await expect(page.getByTestId('detective-results')).toBeVisible();
  await expectNoSeriousViolations(page, 'detective results');
  expectNoPageErrors(errors);
});
