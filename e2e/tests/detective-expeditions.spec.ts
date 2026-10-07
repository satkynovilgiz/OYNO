import en from '../../src/i18n/locales/en.json';
import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, seed, test, waitForStored } from '../helpers';

/** Culture Detective Expeditions: learning round, optional challenge, "What you discovered", practice. */

const names = (en as unknown as { detective: { names: Record<string, string> } }).detective.names;
const idByName = Object.fromEntries(Object.entries(names).map(([id, name]) => [name, id]));
const YURT = ['boz-uy-overview', 'boz-uy-karkas', 'boz-uy-kiyiz-jabuu', 'boz-uy-tunduk', 'boz-uy-ichki-jasalga'];
type Stored = Record<string, { sessions: number; bestScore: number; expeditions?: Record<string, { learning: { bestCorrect: number } | null; challenge: { bestScore: number } | null; missedIds: string[] }> }>;

async function answerAll(page: import('@playwright/test').Page, count: number, _pick: 'first') {
  const asked: string[] = [];
  for (let index = 1; index <= count; index += 1) {
    await expect(page.getByTestId('detective-progress')).toHaveText(`Object ${index} of ${count}`);
    await page.getByRole('radio').first().click();
    asked.push(idByName[(await page.getByTestId('detective-feedback').getByText(/^It is: /).innerText()).replace('It is: ', '')]);
    await page.getByTestId('detective-next').click();
  }
  return asked;
}

test('learning round with every clue, optional challenge, then what was actually answered', async ({ page, errors }) => {
  // Earlier quick-play history (saved before Expeditions existed) must survive.
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.detective.v1': { guest: { bestScore: 9, sessions: 1, lastMissedIds: [], lastPlayedAt: '2026-10-05T10:00:00.000Z' } } } });
  await page.goto('/culture/detective');
  await expect(page.getByTestId('expedition-yurt')).toContainText('5 questions');
  await expect(page.getByTestId('expedition-ornament')).toContainText('4 questions');
  await page.getByTestId('expedition-ornament').click();
  await expect(page.getByTestId('expedition-intro')).toContainText('fewer questions');
  await page.getByText('Back to Culture Detective').click();
  await page.getByTestId('expedition-yurt').click();
  await page.getByTestId('expedition-start').click();

  // Learning: all three clues already open, no reveal button, no points.
  await expect(page.getByTestId('detective-learning-label')).toBeVisible();
  await expect(page.getByTestId('detective-clue-3')).toBeVisible();
  await expect(page.getByTestId('detective-reveal')).toHaveCount(0);
  const learned = await answerAll(page, 5, 'first');
  expect(new Set(learned).size).toBe(5);
  expect([...learned].sort()).toEqual([...YURT].sort());

  await expect(page.getByTestId('expedition-break')).toBeVisible();
  await expect(page.getByTestId('expedition-learning-score')).toHaveText(/Answered correctly: \d of 5/);
  await waitForStored<Stored>(page, 'oyno.detective.v1', (value) => value?.guest?.expeditions?.yurt?.learning != null, 'the learning round is recorded');

  // Challenge: clues start closed.
  await page.getByTestId('expedition-challenge').click();
  await expect(page.getByTestId('detective-reveal')).toBeVisible();
  await expect(page.getByTestId('detective-clue-1')).toHaveCount(0);
  await page.getByTestId('detective-reveal').click();
  await answerAll(page, 5, 'first');

  await expect(page.getByTestId('expedition-discovered')).toBeVisible();
  for (const questionId of ['boz-uy', 'karkas', 'kiyiz-jabuu', 'tunduk', 'ichki-jasalga']) {
    await expect(page.getByTestId(`discovered-${questionId}`)).toContainText(/Learning round: (answered correctly|not this time)/);
    await expect(page.getByTestId(`discovered-${questionId}`)).toContainText(/Challenge: (correct|not this time)/);
  }
  await waitForStored<Stored>(page, 'oyno.detective.v1', (value) => value?.guest?.expeditions?.yurt?.challenge != null, 'the challenge is recorded separately');
  const stored = JSON.parse((await page.evaluate(() => localStorage.getItem('oyno.detective.v1'))) ?? '{}') as Stored;
  // Quick-play history is untouched by expeditions.
  expect(stored.guest).toMatchObject({ bestScore: 9, sessions: 1 });

  // The summary links to the source article.
  await page.getByTestId('discovered-tunduk').click();
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-tunduk$/);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('practice asks only the missed questions of that expedition', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.detective.v1': { guest: { bestScore: 0, sessions: 0, lastMissedIds: [], lastPlayedAt: null, expeditions: { horse: { learning: { bestCorrect: 3, total: 5, rounds: 1 }, challenge: null, missedIds: ['eer', 'oodarysh'] } } } } } });
  await page.goto('/culture/detective');
  await expect(page.getByTestId('expedition-horse')).toContainText('Learning: best 3 of 5');
  await expect(page.getByTestId('expedition-yurt')).toContainText('Not started yet');
  await page.getByTestId('expedition-horse').click();
  await page.getByTestId('expedition-practise').click();
  const asked = await answerAll(page, 2, 'first');
  expect(asked.sort()).toEqual(['horse-eer', 'horse-oodarysh']);
  await expect(page.getByTestId('expedition-discovered')).toBeVisible();
  expectNoPageErrors(errors);
});

test('another account sees none of the guest expedition results', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.detective.v1': { 'user-a': { bestScore: 0, sessions: 0, lastMissedIds: [], lastPlayedAt: null, expeditions: { yurt: { learning: { bestCorrect: 5, total: 5, rounds: 1 }, challenge: null, missedIds: [] } } } } } });
  await page.goto('/culture/detective');
  await expect(page.getByTestId('expedition-yurt')).toContainText('Not started yet');
  expectNoPageErrors(errors);
});

test('Kyrgyz and Russian expeditions are translated; accessible', async ({ page, errors }) => {
  for (const language of ['kg', 'ru'] as const) {
    await seed(page, { language, guest: true });
    await page.goto('/culture/detective');
    await page.getByTestId('expedition-horse').click();
    await page.getByTestId('expedition-start').click();
    await page.getByRole('radio').first().click();
    await expectNoExposedKeys(page);
  }
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/detective');
  await expectNoSeriousViolations(page, 'detective intro with expeditions');
  await page.getByTestId('expedition-yurt').click();
  await expectNoSeriousViolations(page, 'expedition intro');
  await page.getByTestId('expedition-start').click();
  await expectNoSeriousViolations(page, 'learning round');
  expectNoPageErrors(errors);
});
