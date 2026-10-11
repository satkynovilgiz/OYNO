import * as fs from 'fs';
import * as path from 'path';

import type { Page } from '@playwright/test';

import en from '../../src/i18n/locales/en.json';
import { FAKE_SUPABASE } from '../fixtures/backend';
import { FIXTURE_TABLES } from '../fixtures/data';
import { buildTables, readTable } from '../fixtures/postgrest';
import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/**
 * Mystery Object: clue -> a wrong guess (the round goes on) -> reveal ->
 * the right guess -> evidence from the article -> open the source -> Back:
 * the attempt is still there. The mystery is random; the test recognises it
 * from its first clue (the same reviewed text the player reads).
 */
const questions = (en as unknown as { detective: { questions: Record<string, Record<string, string>> } }).detective.questions;
// The definitions, read as text (the model module pulls in bundled images, which the test runner can't load).
const source = fs.readFileSync(path.join(__dirname, '../../src/features/detective/detectiveQuestions.ts'), 'utf8');
const MYSTERIES = [...source.matchAll(/\{ id: '([^']+)', sourceId: '([^']+)'.*?optionIds: \[([^\]]+)\]/g)].map(([, id, sourceId, options]) => ({ id, sourceId, optionIds: [...options.matchAll(/'([^']+)'/g)].map((match) => match[1]) }));

/**
 * The shared fake catalogue has 5 culture items, so no mystery has all four
 * options available (and the screen correctly offers none). Here one real
 * item is added - "The felt covers" - which completes the "karkas" mystery
 * (frame, tunduk, felt covers, shyrdak). Only that mystery can be played.
 */
async function withFeltCovers(page: Page) {
  const karkas = FIXTURE_TABLES.culture_items.find((row) => row.id === 'boz-uy-karkas')!;
  const tables = buildTables({ ...FIXTURE_TABLES, culture_items: [...FIXTURE_TABLES.culture_items, { ...karkas, id: 'boz-uy-kiyiz-jabuu', title: 'Кийиз жабуу', sort_order: 9 }] });
  // The same PostgREST reader the fake backend uses, over these rows.
  await page.route(`${FAKE_SUPABASE}/rest/v1/culture_items*`, async (route) => {
    const request = route.request();
    const read = readTable(tables, 'culture_items', new URL(request.url()).searchParams, request.headers(), request.method() === 'HEAD' ? 'HEAD' : 'GET');
    await route.fulfill({ status: read.status, headers: { 'content-type': 'application/json', ...read.headers }, body: JSON.stringify(read.body) });
  });
}

test('without all four articles no mystery is offered', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/mystery');
  await expect(page.getByTestId('mystery-none')).toContainText('No mystery can be played');
  await expect(page.getByTestId('mystery-begin')).toHaveCount(0);
  expectNoPageErrors(errors);
});

test('clue -> guess -> reveal -> source -> back', async ({ page, errors }) => {
  await withFeltCovers(page);
  await page.setViewportSize({ width: 360, height: 860 });
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture');
  await page.getByTestId('mystery-entry').click();
  await expect(page.getByTestId('mystery-start')).toContainText('No timer and no score');
  await page.getByTestId('mystery-begin').click();
  const clue1 = (await page.getByTestId('mystery-clue-1').innerText()).trim();
  const mystery = MYSTERIES.find((entry) => clue1.includes(questions[entry.id].clue1));
  expect(mystery).toBeTruthy();
  await expect(page.getByTestId('mystery-clue-1')).toContainText('From the article\'s');
  const wrong = mystery!.optionIds.find((id) => id !== mystery!.sourceId)!;

  // A wrong guess: marked, the round continues.
  await page.getByTestId(`mystery-option-${wrong}`).click();
  await expect(page.getByTestId('mystery-try-again')).toBeVisible();
  await expect(page.getByTestId(`mystery-option-${wrong}`)).toBeDisabled();
  await page.getByTestId('mystery-reveal').click();
  await expect(page.getByTestId('mystery-clue-2')).toContainText(questions[mystery!.id].clue2);
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousViolations(page, 'mystery playing');

  await page.getByTestId(`mystery-option-${mystery!.sourceId}`).click();
  await expect(page.getByTestId('mystery-answer')).toContainText('Yes - it');
  await expect(page.getByTestId('mystery-evidence')).toContainText(questions[mystery!.id].explanation);
  await expect(page.getByTestId('mystery-evidence')).toContainText('From the article');
  await expect(page.getByTestId('mystery-answer')).toContainText('Nothing is scored');

  // The source article, then back: clues, the wrong guess and the answer are kept.
  await page.getByTestId('mystery-source').click();
  await expect(page).toHaveURL(new RegExp(`/culture/item/${mystery!.sourceId}`));
  await page.goBack();
  await expect(page.getByTestId('mystery-clue-2')).toBeVisible();
  await expect(page.getByTestId(`mystery-option-${wrong}`)).toContainText('not this one');
  await expect(page.getByTestId('mystery-answer')).toBeVisible();
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('KG: plays with reviewed Kyrgyz clues', async ({ page, errors }) => {
  await withFeltCovers(page);
  await seed(page, { language: 'kg', guest: true });
  await page.goto('/culture/mystery');
  await page.getByTestId('mystery-begin').click();
  await expect(page.getByTestId('mystery-clue-1')).toContainText('бөлүмүнөн');
  await page.getByTestId('mystery-show-answer').click();
  await expect(page.getByTestId('mystery-answer')).toBeVisible();
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
