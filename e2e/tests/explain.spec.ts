import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, readStored, seed, test } from '../helpers';

/** Explain it yourself: read -> explain -> open the source (draft kept) -> save -> reopen -> revise. */
const visible = (page: import('@playwright/test').Page, id: string) => page.locator(`[data-testid="${id}"]`).locator('visible=true');

test('read -> explain -> source -> save -> reopen', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/item/boz-uy-overview');
  await page.getByTestId('explain-entry').click();
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-overview\/explain$/);
  await expect(visible(page, 'explain')).toContainText("doesn't grade or check");

  await visible(page, 'explain-prompt-mainIdea').click();
  await visible(page, 'explain-text').fill('Synthetic explanation 7e: a home that can be moved.');
  await visible(page, 'explain-toggle-source').click();
  await expect(visible(page, 'explain-source')).toContainText('fixture text');

  // Opening the article keeps the draft.
  await visible(page, 'explain-open-article').click();
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-overview$/);
  await page.goBack();
  await expect(visible(page, 'explain-text')).toHaveValue('Synthetic explanation 7e: a home that can be moved.');
  await expectNoSeriousViolations(page, 'explain');

  await visible(page, 'explain-save').click();
  await expect(visible(page, 'explain-saved')).toBeVisible();
  const stored = await readStored<Record<string, Record<string, { text: string; promptId: string; revisions: number }>>>(page, 'oyno.explanations.v1');
  expect(stored!.guest['boz-uy-overview']).toMatchObject({ text: 'Synthetic explanation 7e: a home that can be moved.', promptId: 'mainIdea', revisions: 0 });

  // Reopen after a restart, then revise.
  await page.goto('/profile/explanations');
  await page.getByTestId('explanation-boz-uy-overview').click();
  await expect(visible(page, 'explain-text')).toHaveValue('Synthetic explanation 7e: a home that can be moved.');
  await visible(page, 'explain-text').fill('Revised 7e.');
  await expect(visible(page, 'explain-revising')).toBeVisible();
  await visible(page, 'explain-save').click();
  await expect(visible(page, 'explain-saved')).toBeVisible();
  const after = await readStored<Record<string, Record<string, { text: string; revisions: number }>>>(page, 'oyno.explanations.v1');
  expect(after!.guest['boz-uy-overview']).toMatchObject({ text: 'Revised 7e.', revisions: 1 });
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('a removed article keeps the writing (RU)', async ({ page, errors }) => {
  const entry = { articleId: 'removed-article', titleSnapshot: 'Старая статья', promptId: 'friend', text: 'Мой текст 3r', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', revisions: 0 };
  await seed(page, { language: 'ru', guest: true, storage: { 'oyno.explanations.v1': { guest: { 'removed-article': entry }, 'user-x': { a: { ...entry, articleId: 'a', text: 'Чужой 9q' } } } } });
  await page.goto('/profile/explanations');
  await expect(page.getByTestId('explanations')).not.toContainText('Чужой 9q');
  await page.getByTestId('explanation-removed-article').click();
  await expect(page.getByTestId('explain-article-missing')).toBeVisible();
  await expect(page.getByTestId('explain-text')).toHaveValue('Мой текст 3r');
  expectNoPageErrors(errors);
});
