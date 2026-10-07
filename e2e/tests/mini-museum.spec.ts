import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Mini Museum: arrange, caption, present (incl. removed content), restart, share preview. */

const AT = '2026-10-01T10:00:00.000Z';
const ID = 'uc_museum_test';
// Synthetic text only.
const CAPTION = 'Synthetic caption about the crown 4p';
const INTRO = 'Synthetic introduction 8w';
const item = (contentId: string, sortOrder: number) => ({ collectionId: ID, contentType: 'culture_item', contentId, sortOrder, addedAt: AT });
const collections = {
  guest: {
    collections: [{ id: ID, name: 'Yurt things', description: 'Private description 3x', createdAt: AT, updatedAt: AT }],
    items: [item('boz-uy-overview', 0), item('boz-uy-tunduk', 1), item('boz-uy-karkas', 2), item('removed-from-oyno', 3)],
  },
};

test('arrange, caption, present, survive a restart, and share exactly the previewed cover', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.myCollections.v1': collections } });
  await page.goto(`/profile/my-collections/${ID}`);
  await page.getByTestId('museum-entry').click();
  await expect(page.getByTestId('museum-setup')).toBeVisible();
  await page.getByTestId('museum-title').fill('The yurt, piece by piece');
  await page.getByTestId('museum-intro').fill(INTRO);
  // Order: move the first exhibit (overview) down one.
  await expect(page.getByTestId('museum-exhibit-0')).toContainText('Боз үй');
  await page.getByTestId('museum-down-0').click();
  await expect(page.getByTestId('museum-exhibit-0')).toContainText('Түндүк');
  await page.getByTestId('museum-caption-0').fill(CAPTION);

  // Survives a restart.
  await page.reload();
  await expect(page.getByTestId('museum-exhibit-0')).toContainText('Түндүк');
  await expect(page.getByTestId('museum-caption-0')).toHaveValue(CAPTION);

  await page.getByTestId('museum-present').click();
  await expect(page.getByTestId('museum-slide-of')).toHaveText('Exhibit 1 of 4');
  await expect(page.getByTestId('museum-slide-title')).toHaveText('Түндүк');
  // The owner's words are shown apart from OYNO's content.
  await expect(page.getByTestId('museum-slide-caption')).toContainText(`Your caption${CAPTION}`);
  await expect(page.getByText('From OYNO')).toBeVisible();
  for (let index = 2; index <= 4; index += 1) await page.getByTestId('museum-next').click();
  // The fourth exhibit was removed from OYNO: said so, not blank.
  await expect(page.getByTestId('museum-removed')).toContainText('no longer available');
  await page.getByTestId('museum-finish').click();

  // Share: the preview is the card - title and count; never the caption or the private description.
  await page.getByTestId('museum-share').click();
  const preview = page.getByRole('dialog');
  await expect(preview).toContainText('The yurt, piece by piece');
  await expect(preview).toContainText('4 exhibits');
  await expect(preview).not.toContainText(CAPTION);
  await expect(preview).not.toContainText('Private description');
  await expect(preview).not.toContainText(INTRO); // introduction is off by default
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('another account never sees the captions', async ({ page, errors }) => {
  // Captions saved for "user-a"; this device is now a guest.
  await seed(page, {
    language: 'en',
    guest: true,
    storage: {
      'oyno.myCollections.v1': { 'user-a': collections.guest },
      'oyno.myCollections.museums.v1': { 'user-a': { [ID]: { title: 'A title', intro: INTRO, exhibits: ['culture_item:boz-uy-tunduk'], captions: { 'culture_item:boz-uy-tunduk': CAPTION }, updatedAt: AT } } },
    },
  });
  await page.goto(`/profile/my-collections/museum?collection=${ID}`);
  // The guest has no such collection: nothing of A's is shown.
  await expect(page.locator('body')).not.toContainText(CAPTION);
  await expect(page.locator('body')).not.toContainText(INTRO);
  expectNoPageErrors(errors);
});

test('accessible setup and presentation', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.myCollections.v1': collections } });
  await page.goto(`/profile/my-collections/museum?collection=${ID}`);
  await expectNoSeriousViolations(page, 'museum setup');
  await page.getByTestId('museum-present').click();
  await expectNoSeriousViolations(page, 'museum presentation');
  expectNoPageErrors(errors);
});
