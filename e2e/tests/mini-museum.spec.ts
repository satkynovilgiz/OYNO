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

test('visitor tour: curator order, optional reflection, removed exhibit, closing with sources', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.myCollections.v1': collections } });
  await page.goto(`/profile/my-collections/museum?collection=${ID}`);
  await page.getByTestId('museum-caption-1').fill(CAPTION);
  // A reflection prompt after the second exhibit (cycle: none -> first prompt).
  await page.getByTestId('museum-reflection-1').click();
  await expect(page.getByTestId('museum-reflection-1')).toContainText('Which detail would you point out');
  await page.getByTestId('museum-visit').click();

  await expect(page.getByTestId('tour-welcome')).toContainText('Yurt things');
  await expect(page.locator('body')).not.toContainText('Private description');
  await page.getByTestId('tour-next').click();
  await expect(page.getByTestId('tour-progress')).toContainText('Exhibit 1 of 4');
  await expect(page.getByTestId('tour-exhibit-title')).toHaveText('Боз үй');
  await page.getByTestId('tour-next').click();
  await expect(page.getByTestId('tour-exhibit-title')).toHaveText('Түндүк');
  await expect(page.getByTestId('tour-caption')).toContainText(`Curator's note${CAPTION}`);
  await page.getByTestId('tour-next').click();
  // The reflection: clearly a prompt, optional - skip it.
  await expect(page.getByTestId('tour-reflection')).toContainText('not a fact about the object');
  await page.getByTestId('tour-skip').click();
  await expect(page.getByTestId('tour-exhibit-title')).toHaveText('Жыгач каркас');
  // Back to an earlier exhibit, then on.
  await page.getByTestId('tour-previous').click();
  await page.getByTestId('tour-previous').click();
  await expect(page.getByTestId('tour-exhibit-title')).toHaveText('Түндүк');
  await page.getByTestId('tour-next').click();
  await page.getByTestId('tour-next').click();
  await page.getByTestId('tour-next').click();
  // The removed exhibit is a clear step that doesn't block the rest.
  await expect(page.getByTestId('tour-exhibit-removed')).toContainText('no longer available');
  await page.getByTestId('tour-next').click();

  await expect(page.getByTestId('tour-closing')).toBeVisible();
  await expect(page.getByTestId('tour-row-0')).toContainText('Viewed');
  await expect(page.getByTestId('tour-row-3')).toContainText('No longer available');
  await expect(page.getByTestId('tour-not-learning')).toContainText("isn't counted as learning");
  await page.getByTestId('tour-source-1').click();
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-tunduk$/);
  // Viewing records nothing as learning or progress.
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => /progress|learning|completion/i.test(key) && localStorage.getItem(key) !== null && localStorage.getItem(key) !== '{}'))).toEqual([]);
  expectNoPageErrors(errors);
});

test('visitor tour: text-first mode, translated, accessible', async ({ page, errors }) => {
  for (const language of ['kg', 'ru'] as const) {
    await seed(page, { language, guest: true, storage: { 'oyno.myCollections.v1': collections } });
    await page.goto(`/profile/my-collections/museum?collection=${ID}`);
    await page.getByTestId('museum-visit').click();
    await page.getByTestId('tour-next').click();
    await expectNoExposedKeys(page);
  }
  expectNoPageErrors(errors);
});

test('visitor tour accessible (welcome, exhibit, closing)', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.myCollections.v1': collections } });
  await page.goto(`/profile/my-collections/museum?collection=${ID}`);
  await page.getByTestId('museum-visit').click();
  await page.getByRole('switch').click(); // text first
  await expectNoSeriousViolations(page, 'tour welcome');
  await page.getByTestId('tour-next').click();
  await expectNoSeriousViolations(page, 'tour exhibit (text first)');
  for (let index = 0; index < 4; index += 1) await page.getByTestId('tour-next').click();
  await expect(page.getByTestId('tour-closing')).toBeVisible();
  await expectNoSeriousViolations(page, 'tour closing');
  expectNoPageErrors(errors);
});

test('Look Closely: create clues, play, reveal, open the source and come back', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.myCollections.v1': collections } });
  await page.goto(`/profile/my-collections/museum?collection=${ID}`);
  // The removed exhibit can't join the game.
  await expect(page.getByTestId('look-pick-culture_item:removed-from-oyno')).toBeDisabled();
  for (const key of ['culture_item:boz-uy-overview', 'culture_item:boz-uy-tunduk', 'culture_item:boz-uy-karkas']) await page.getByTestId(`look-pick-${key}`).click();
  await page.getByTestId('look-add-clue').click();
  await page.getByTestId('look-clue-text-0').fill('Find the round opening at the very top.');
  await page.getByTestId('look-target-0-culture_item:boz-uy-tunduk').click();
  // Saved with the exhibition: survives a reload.
  await page.reload();
  await expect(page.getByTestId('look-clue-text-0')).toHaveValue('Find the round opening at the very top.');
  await page.getByTestId('look-play').click();

  await expect(page.getByTestId('look-play-view')).toContainText("Curator's clue - written by the curator, not a verified OYNO fact");
  await expect(page.getByTestId('look-clue')).toHaveText('Find the round opening at the very top.');
  await expect(page.locator('body')).not.toContainText('Private description');
  // A wrong answer: no penalty, just look again.
  await page.getByTestId('look-answer-culture_item:boz-uy-karkas').click();
  await expect(page.getByTestId('look-try-again')).toContainText('No points and no score');
  await page.getByTestId('look-answer-culture_item:boz-uy-tunduk').click();
  await expect(page.getByTestId('look-reveal')).toContainText('The answer: Түндүк');
  await expect(page.getByTestId('look-reveal')).toContainText('Find the round opening at the very top.');

  await page.getByTestId('look-open-source').click();
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-tunduk$/);
  await page.goBack();
  // Back in the game, where we were.
  await expect(page.getByTestId('look-reveal')).toBeVisible();
  await page.getByTestId('look-next').click();
  await expect(page.getByTestId('look-done')).toContainText('Found 1 of 1');
  // Nothing about the game was stored as learning or quiz results.
  const stored = await page.evaluate(() => Object.keys(localStorage).filter((key) => /challenge|quiz|progress|learning/i.test(key) && !['{}', null].includes(localStorage.getItem(key))));
  expect(stored).toEqual([]);
  await page.getByTestId('look-restart').click();
  await expect(page.getByTestId('look-progress')).toHaveText('Clue 1 of 1');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('Look Closely: translated and accessible', async ({ page, errors }) => {
  const look = { exhibits: ['culture_item:boz-uy-overview', 'culture_item:boz-uy-tunduk'], clues: [{ id: 'c1', target: 'culture_item:boz-uy-tunduk', text: 'Synthetic clue 4r' }] };
  const museums = { guest: { [ID]: { title: 'Yurt', intro: '', exhibits: ['culture_item:boz-uy-overview', 'culture_item:boz-uy-tunduk'], captions: {}, lookClosely: look, updatedAt: AT } } };
  await seed(page, { language: 'ru', guest: true, storage: { 'oyno.myCollections.v1': collections, 'oyno.myCollections.museums.v1': museums } });
  await page.goto(`/profile/my-collections/museum?collection=${ID}`);
  await expectNoSeriousViolations(page, 'look closely setup');
  await page.getByTestId('look-play').click();
  await page.getByTestId('look-answer-culture_item:boz-uy-overview').click();
  await expectNoExposedKeys(page);
  await expectNoSeriousViolations(page, 'look closely play');
  expectNoPageErrors(errors);
});
