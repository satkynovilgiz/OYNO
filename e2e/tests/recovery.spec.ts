import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, readStored, seed, test } from '../helpers';

/** Recovery Center: an unsaved scrapbook edit is listed -> retry saves it; a stored journal draft is discarded with confirmation; others stay. */
const BOOK = { id: 'sbtrip1', title: 'Trip', entries: [], createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };
const draft = (target: string, title: string) => ({ v: 1, target, entryId: target === 'new' ? 'e-new-1' : target, fields: { title, note: '', date: '2026-10-01', photoUri: null, link: null }, baseUpdatedAt: null, savedAt: '2026-10-01T00:00:00Z' });
const visible = (page: import('@playwright/test').Page, id: string) => page.locator(`[data-testid="${id}"]`).locator('visible=true');

test('unsaved edit -> Recovery Center -> retry; discard one draft', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.scrapbooks.v1': { guest: [BOOK] }, 'oyno.journal.drafts.v1': { guest: { new: draft('new', 'Unfinished memory') } } } });
  await page.goto('/profile');
  await page.getByText('Recovery Center').click();
  await expect(visible(page, 'recovery-journal:new')).toContainText('Kept after the app restarts');
  await page.goBack();

  // Make an unsaved edit in the scrapbook editor (in-app navigation keeps it in memory).
  await page.getByText('Cultural scrapbooks', { exact: true }).locator('visible=true').click();
  await visible(page, 'scrapbook-open-sbtrip1').click();
  await visible(page, 'scrapbook-title').fill('Trip, edited');
  await page.goBack();
  await page.goBack();
  await page.getByText('Recovery Center').click();

  const entry = visible(page, 'recovery-scrapbook:sbtrip1');
  await expect(entry).toContainText('Unsaved edits - not saved yet');
  await expect(entry).toContainText('Kept only until the app is closed');
  await expect(visible(page, 'recovery')).toContainText('Journal drafts are stored on this device');
  await expectNoSeriousViolations(page, 'recovery center');
  await visible(page, 'recovery-retry-scrapbook:sbtrip1').click();
  await expect(visible(page, 'recovery-retried')).toBeVisible();
  await expect(page.locator('[data-testid="recovery-scrapbook:sbtrip1"]')).toHaveCount(0);
  const books = await readStored<Record<string, { title: string }[]>>(page, 'oyno.scrapbooks.v1');
  expect(books!.guest.map((b) => b.title)).toEqual(['Trip, edited']);

  // Discard the journal draft, with confirmation; the scrapbook stays saved.
  await visible(page, 'recovery-discard-journal:new').click();
  await visible(page, 'recovery-discard-yes-journal:new').click();
  await expect(visible(page, 'recovery-empty')).toBeVisible();
  expect((await readStored<Record<string, Record<string, unknown>>>(page, 'oyno.journal.drafts.v1'))?.guest?.new).toBeUndefined();
  expect((await readStored<Record<string, { title: string }[]>>(page, 'oyno.scrapbooks.v1'))!.guest[0].title).toBe('Trip, edited');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test("another owner's drafts are not shown (RU)", async ({ page, errors }) => {
  await seed(page, { language: 'ru', guest: true, storage: { 'oyno.journal.drafts.v1': { 'user-x': { new: draft('new', 'Чужой черновик') } } } });
  await page.goto('/profile/recovery');
  await expect(page.getByTestId('recovery-empty')).toBeVisible();
  await expect(page.getByTestId('recovery')).not.toContainText('Чужой черновик');
  expectNoPageErrors(errors);
});
