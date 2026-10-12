import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, readStored, seed, test } from '../helpers';

/** My Questions: section -> question (draft survives leaving) -> supporting article -> personal answer -> answered -> reopen. */
test('question -> supporting article -> personal answer -> reopen', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/item/boz-uy-overview');
  await page.getByTestId('question-save-origin').click();
  await page.getByTestId('question-input-origin').fill('Who first set up a boz uy like this?');

  // The draft survives going somewhere else and coming back.
  await page.getByTestId('board-from-article').click(); // in-app navigation away
  await expect(page).toHaveURL(/\/culture\/board/);
  await page.goBack();
  await expect(page.locator('[data-testid="question-input-origin"]').locator('visible=true')).toHaveValue('Who first set up a boz uy like this?');
  await page.locator('[data-testid="question-submit-origin"]').locator('visible=true').click();
  await page.locator('[data-testid="question-saved"]').locator('visible=true').click();
  await expect(page).toHaveURL(/\/profile\/questions\/q-/);

  const detail = page.getByTestId('question-detail');
  await expect(page.getByTestId('question-status')).toHaveText('Still exploring');
  await expect(page.getByTestId('question-origin')).toContainText('Боз үй');
  await page.getByTestId('question-support-search').fill('Түндүк');
  await page.getByTestId('question-support-add-boz-uy-tunduk').click();
  await expect(page.getByTestId('question-support-boz-uy-tunduk')).toBeVisible();
  await page.getByTestId('question-support-open-boz-uy-tunduk').click();
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-tunduk$/);
  await page.goBack();

  await page.locator('[data-testid="question-answer"]').locator('visible=true').fill('My own guess so far: families, long ago.');
  await page.locator('[data-testid="question-save-edits"]').locator('visible=true').click();
  await expect(page.locator('[data-testid="question-save-edits"]').locator('visible=true')).toBeDisabled();
  await expect(detail.locator('visible=true')).toContainText("OYNO doesn't write, check or certify answers");
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousViolations(page, 'question detail');
  await page.locator('[data-testid="question-mark-answered"]').locator('visible=true').click();
  await expect(page.locator('[data-testid="question-status"]').locator('visible=true')).toHaveText('Answered for now');

  // Survives a restart; the question, its article and the answer are all kept.
  await page.goto('/profile/questions');
  await page.getByTestId('questions-tab-answered').click();
  const row = page.locator('[data-testid^="questions-item-"]');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Who first set up a boz uy like this?');
  await expect(row).toContainText('1 OYNO article · your answer written');
  await row.click();
  await page.locator('[data-testid="question-reopen"]').locator('visible=true').click();
  await expect(page.locator('[data-testid="question-status"]').locator('visible=true')).toHaveText('Still exploring');
  await expect(page.locator('[data-testid="question-answer"]').locator('visible=true')).toHaveValue('My own guess so far: families, long ago.');
  const stored = await readStored<Record<string, Record<string, { status: string; supports: unknown[]; origin: { sectionKey: string } }>>>(page, 'oyno.questions.v1');
  const [q] = Object.values(stored!.guest);
  expect(q).toMatchObject({ status: 'exploring', origin: { sectionKey: 'origin' }, supports: [{ articleId: 'boz-uy-tunduk' }] });
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('a question whose section disappeared keeps its origin and is not moved', async ({ page, errors }) => {
  const question = { id: 'q-1', text: 'About a vanished section?', origin: { articleId: 'boz-uy-overview', sectionKey: 'fun_facts', articleTitle: 'Old title', sectionLabel: 'Fun facts' }, supports: [{ articleId: 'gone-article', title: 'A removed article' }], answer: '', status: 'exploring', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', answeredAt: null };
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.questions.v1': { guest: { 'q-1': question }, 'user-x': { 'q-2': { ...question, id: 'q-2', text: 'Someone else' } } } } });
  await page.goto('/profile/questions');
  await expect(page.locator('[data-testid^="questions-item-"]')).toHaveCount(1); // only this owner's
  await page.getByTestId('questions-item-q-1').click();
  await expect(page.getByTestId('question-origin-section-missing')).toContainText("isn't moved to another section");
  await expect(page.getByTestId('question-open-origin')).toHaveCount(0);
  await expect(page.getByTestId('question-support-gone-article')).toContainText('A removed article');
  await expect(page.getByTestId('question-support-gone-article')).toContainText('No longer available');
  // Confirmed delete.
  await page.getByTestId('question-delete').click();
  await page.getByTestId('question-delete-yes').click();
  await expect(page).toHaveURL(/\/profile\/questions$/);
  await expect(page.locator('[data-testid="questions-empty-exploring"]').locator('visible=true')).toBeVisible();
  expectNoPageErrors(errors);
});
