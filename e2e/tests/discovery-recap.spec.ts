import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, readStored, seed, test } from '../helpers';

/** Discovery Recap: saved records in a range -> select -> add to My Next Visit -> open. A broken source doesn't hide the others. */
const recent = new Date(Date.now() - 2 * 86_400_000).toISOString();
const old = new Date(Date.now() - 90 * 86_400_000).toISOString();
const visible = (page: import('@playwright/test').Page, id: string) => page.locator(`[data-testid="${id}"]`).locator('visible=true');

const storage = {
  'oyno.sectionBookmarks.v1': {
    guest: {
      'culture_item:boz-uy-tunduk#history': { contentType: 'culture_item', contentId: 'boz-uy-tunduk', sectionKey: 'history', articleTitle: 'Түндүк', sectionLabel: 'History', note: 'Synthetic recap note 5t', createdAt: recent, updatedAt: recent },
      'culture_item:boz-uy-karkas#history': { contentType: 'culture_item', contentId: 'boz-uy-karkas', sectionKey: 'history', articleTitle: 'Жыгач каркас', sectionLabel: 'History', note: 'Too old 1x', createdAt: old, updatedAt: old },
      'culture_item:removed-article#origin': { contentType: 'culture_item', contentId: 'removed-article', sectionKey: 'origin', articleTitle: 'Old article', sectionLabel: 'Origin', note: 'Kept words 8k', createdAt: recent, updatedAt: recent },
    },
    'user-x': { 'culture_item:boz-uy#history': { contentType: 'culture_item', contentId: 'boz-uy', sectionKey: 'history', articleTitle: 'Not mine', sectionLabel: 'History', note: 'Other owner 9z', createdAt: recent, updatedAt: recent } },
  },
  'oyno.listeningNotebook.v1': { guest: { mrecap01: { id: 'mrecap01', trackId: 'ak-maral-min', seconds: 12, titleSnapshot: 'Ак марал мин', note: 'Synthetic moment 2q', createdAt: recent, updatedAt: recent } } },
  'oyno.questions.v1': '{broken',
  'oyno.timeCapsules.v1': { guest: [{ id: 'cap1', title: 'Sealed', message: 'SECRET capsule message 4p', status: 'sealed', createdAt: recent }] },
};

test('recap -> select -> add to plan -> open', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await seed(page, { language: 'en', guest: true, storage });
  await page.goto('/profile/discovery-recap');
  await expect(page.getByTestId('discovery-recap-included')).toContainText('Time capsules are not included');

  await expect(page.getByTestId('recap-group-note')).toContainText('Synthetic recap note 5t');
  await expect(page.getByTestId('recap-group-note')).not.toContainText('Too old 1x'); // outside the last 30 days
  await expect(page.getByTestId('discovery-recap')).not.toContainText('Other owner 9z');
  await expect(page.getByTestId('discovery-recap')).not.toContainText('SECRET capsule message');
  await expect(page.getByTestId('recap-group-note')).toContainText("isn't available any more");
  await expect(page.getByTestId('recap-group-note')).toContainText('Kept words 8k');
  await expect(page.getByTestId('recap-error-question')).toBeVisible(); // a broken source...
  await expect(page.getByTestId('recap-group-moment')).toContainText('Synthetic moment 2q'); // ...doesn't hide the rest
  await expect(page.getByTestId('recap-unavailable-design')).toBeVisible();

  // Searching the private view.
  await page.getByTestId('recap-search').fill('moment 2q');
  await expect(page.getByTestId('recap-group-note')).not.toContainText('Synthetic recap note');
  await page.getByTestId('recap-search').fill('');

  await page.getByTestId('recap-select-note:culture_item:boz-uy-tunduk#history').click();
  await page.getByTestId('recap-select-moment:mrecap01').click();
  await page.getByTestId('recap-select-note:culture_item:removed-article#origin').click();
  await expectNoSeriousViolations(page, 'discovery recap');
  await page.getByTestId('recap-add').click();
  await expect(page.getByTestId('recap-add-result')).toContainText('2 added.');
  await expect(page.getByTestId('recap-add-result')).toContainText("1 can't be planned.");
  const plan = await readStored<Record<string, { kind: string; id: string }[]>>(page, 'oyno.nextVisit.v1');
  expect(plan!.guest.map((i) => `${i.kind}:${i.id}`)).toEqual(['article:boz-uy-tunduk', 'activity:komuzListen']);

  // Adding again doesn't duplicate.
  await page.getByTestId('recap-add').click();
  await expect(page.getByTestId('recap-add-result')).toContainText('0 added.');

  await page.getByTestId('recap-open-plan').click();
  await visible(page, 'next-visit-open-0').click();
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-tunduk$/);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('custom dates: an invalid range says so (KG)', async ({ page, errors }) => {
  await seed(page, { language: 'kg', guest: true, storage });
  await page.goto('/profile/discovery-recap');
  await page.getByTestId('recap-range-custom').click();
  await page.getByTestId('recap-from').fill('2026-12-01');
  await page.getByTestId('recap-to').fill('2026-01-01');
  await expect(page.getByTestId('recap-bad-range')).toBeVisible();
  expectNoPageErrors(errors);
});
