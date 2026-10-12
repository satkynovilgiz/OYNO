import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, readStored, seed, test } from '../helpers';

/** Theme tags: tag a question and a scrapbook -> filter -> rename -> reopen a record. Records are never changed. */
const QUESTION = { id: 'q-tag-1', text: 'Synthetic tagged question 4h?', origin: null, supports: [], answer: '', status: 'exploring', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', answeredAt: null };
const BOOK = { id: 'sbtagged1', title: 'Synthetic book 6m', entries: [], createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };
const visible = (page: import('@playwright/test').Page, id: string) => page.locator(`[data-testid="${id}"]`).locator('visible=true');

test('tag two record types -> filter -> rename -> reopen', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.questions.v1': { guest: { [QUESTION.id]: QUESTION } }, 'oyno.scrapbooks.v1': { guest: [BOOK] } } });
  await page.goto(`/profile/questions/${QUESTION.id}`);
  await visible(page, 'tag-picker-toggle').click();
  await expect(visible(page, 'tag-picker')).toContainText('not a cultural classification');
  await visible(page, 'tag-new-name').fill('Patterns');
  await visible(page, 'tag-create').click();
  await expect(visible(page, 'tag-picker')).toContainText('Patterns');

  await page.goto(`/profile/scrapbooks/${BOOK.id}`);
  await visible(page, 'tag-picker-toggle').click();
  await visible(page, 'tag-option-Patterns').click();
  await expect(visible(page, 'tag-option-Patterns')).toHaveAttribute('aria-checked', 'true');

  await page.goto('/profile/tags');
  await expect(visible(page, 'tag-Patterns')).toContainText('2 records');
  await visible(page, 'tag-Patterns').click();
  await expect(page.locator('[data-testid^="tag-record-"]').locator('visible=true')).toHaveCount(2);
  await visible(page, 'tag-filter-question').click();
  await expect(page.locator('[data-testid^="tag-record-"]').locator('visible=true')).toHaveCount(1);
  await expect(visible(page, `tag-record-question-${QUESTION.id}`)).toContainText('Synthetic tagged question 4h?');
  await expectNoSeriousViolations(page, 'tag detail');

  await visible(page, 'tag-rename').click();
  await visible(page, 'tag-rename-field').fill('Ornaments');
  await visible(page, 'tag-rename-save').click();
  await page.reload();
  await expect(page.getByTestId('tag-detail')).toBeVisible();
  await page.goto('/profile/tags');
  await expect(visible(page, 'tag-Ornaments')).toBeVisible();
  await expect(page.locator('[data-testid="tag-Patterns"]')).toHaveCount(0);
  await visible(page, 'tag-Ornaments').click();
  await visible(page, `tag-open-scrapbook-${BOOK.id}`).click();
  await expect(page).toHaveURL(new RegExp(`/profile/scrapbooks/${BOOK.id}$`));
  await expect(visible(page, 'tag-picker')).toContainText('Ornaments'); // the renamed tag shows everywhere

  // The records themselves were never written by tagging.
  expect(await readStored(page, 'oyno.questions.v1')).toEqual({ guest: { [QUESTION.id]: QUESTION } });
  expect(await readStored(page, 'oyno.scrapbooks.v1')).toEqual({ guest: [BOOK] });
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test("missing records are placeholders; another owner's tags are hidden; delete keeps records (RU)", async ({ page, errors }) => {
  const tags = { guest: { tags: { t0: { id: 't0', name: 'Музыка', createdAt: '' } }, refs: { t0: [{ type: 'moment', id: 'mgone01' }, { type: 'question', id: QUESTION.id }] } }, 'user-x': { tags: { t9: { id: 't9', name: 'Чужая', createdAt: '' } }, refs: { t9: [] } } };
  await seed(page, { language: 'ru', guest: true, storage: { 'oyno.tags.v1': tags, 'oyno.questions.v1': { guest: { [QUESTION.id]: QUESTION } } } });
  await page.goto('/profile/tags');
  await expect(page.getByTestId('tags')).not.toContainText('Чужая');
  await page.getByTestId('tag-Музыка').click();
  await expect(page.getByTestId('tag-record-moment-mgone01')).toContainText('больше недоступна');
  await page.getByTestId('tag-detach-moment-mgone01').click();
  await expect(page.locator('[data-testid^="tag-record-"]')).toHaveCount(1);
  await page.getByTestId('tag-delete').click();
  await page.getByTestId('tag-delete-yes').click();
  await expect(page).toHaveURL(/\/profile\/tags$/);
  expect(await readStored(page, 'oyno.questions.v1')).toEqual({ guest: { [QUESTION.id]: QUESTION } });
  expectNoPageErrors(errors);
});
