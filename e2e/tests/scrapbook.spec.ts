import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, readStored, seed, test } from '../helpers';

/** Cultural Scrapbook: add (article, journal reflection, listening moment) -> arrange -> caption -> read -> open a source -> return -> reopen. */
const AT = '2026-10-01T10:00:00.000Z';
const journal = [{ id: 'jsynthetic1', title: 'Synthetic reflection 6m', note: 'Synthetic journal words', date: '2026-10-01', photo: null, link: null, createdAt: AT, updatedAt: AT, deletedAt: null }];
const notebook = { guest: { msynthetic01: { id: 'msynthetic01', trackId: 'ak-maral-min', seconds: 12, titleSnapshot: 'Ак марал мин', note: 'Synthetic listening note', createdAt: AT, updatedAt: AT } } };

test('add -> arrange -> source -> return -> reopen', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.journal.v1': journal, 'oyno.listeningNotebook.v1': notebook } });
  await page.goto('/profile/scrapbooks');
  await expect(page.getByTestId('scrapbook-list')).toContainText('live link');
  await page.getByTestId('scrapbook-new-title').fill('Synthetic scrapbook 1k');
  await page.getByTestId('scrapbook-create').click();

  await page.getByTestId('scrapbook-search').fill('Түн');
  await page.getByTestId('scrapbook-add-boz-uy-tunduk').click();
  await page.getByTestId('scrapbook-kind-journal').click();
  await page.getByTestId('scrapbook-add-jsynthetic1').click();
  await page.getByTestId('scrapbook-kind-moment').click();
  await page.getByTestId('scrapbook-add-msynthetic01').click();
  await expect(page.getByTestId('scrapbook-edit')).toContainText("Time capsules can't be added");
  await page.getByTestId('scrapbook-down-0').click(); // reflection first
  await expect(page.getByTestId('scrapbook-entry-0')).toContainText('Synthetic reflection 6m');
  await page.getByTestId('scrapbook-caption-1').fill('Synthetic caption 3s');
  await page.getByTestId('scrapbook-save').click();
  await expect(page.getByTestId('scrapbook-unsaved')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  // Read page by page, open the article source, come back.
  await page.getByTestId('scrapbook-mode-read').click();
  await expect(page.getByTestId('scrapbook-page')).toHaveText('Page 1 of 3');
  await page.getByTestId('scrapbook-next').click();
  await expect(page.getByTestId('scrapbook-read')).toContainText('Your captionSynthetic caption 3s');
  await expectNoSeriousViolations(page, 'scrapbook read');
  await page.getByTestId('scrapbook-open-source').click();
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-tunduk/);
  await page.goBack();
  await expect(page.getByTestId('scrapbook-screen')).toBeVisible();

  // Reopen after a restart; the sources were never changed.
  await page.goto('/profile/scrapbooks');
  const stored = await readStored<Record<string, { id: string; entries: { ref: { kind: string } }[] }[]>>(page, 'oyno.scrapbooks.v1');
  expect(stored?.guest?.[0].entries.map((entry) => entry.ref.kind)).toEqual(['journal', 'article', 'moment']);
  await page.getByTestId(`scrapbook-open-${stored!.guest[0].id}`).click();
  await expect(page.getByTestId('scrapbook-caption-1')).toHaveValue('Synthetic caption 3s');
  expect(await readStored(page, 'oyno.journal.v1')).toEqual(journal);
  expect(await readStored(page, 'oyno.listeningNotebook.v1')).toEqual(notebook);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('a source that disappeared keeps the placeholder and caption (RU)', async ({ page, errors }) => {
  await seed(page, { language: 'ru', guest: true, storage: { 'oyno.scrapbooks.v1': { guest: [{ id: 'sbsynthetic1', title: 'Synthetic', entries: [{ key: 'journal:jgone', ref: { kind: 'journal', id: 'jgone' }, titleSnapshot: 'A deleted reflection 9x', caption: 'Kept caption 5v' }], createdAt: AT, updatedAt: AT }] } } });
  await page.goto('/profile/scrapbooks/sbsynthetic1');
  await expect(page.getByTestId('scrapbook-missing-0')).toContainText('A deleted reflection 9x');
  await expect(page.getByTestId('scrapbook-caption-0')).toHaveValue('Kept caption 5v');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
