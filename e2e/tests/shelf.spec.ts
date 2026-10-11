import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** My OYNO Shelf over three real record types (exhibition, board, sealed capsule); designs need an account. */
const AT = '2026-10-01T10:00:00.000Z';
const SECRET = 'Synthetic sealed message 5x';
const storage = {
  'oyno.myCollections.v1': { guest: { collections: [{ id: 'uc_shelf', name: 'Yurt things', description: null, createdAt: AT, updatedAt: AT }], items: [{ collectionId: 'uc_shelf', contentType: 'culture_item', contentId: 'boz-uy-tunduk', sortOrder: 0, addedAt: AT }] } },
  'oyno.myCollections.museums.v1': { guest: { uc_shelf: { title: 'Synthetic exhibition 2e', intro: '', exhibits: ['culture_item:boz-uy-tunduk'], captions: {}, updatedAt: '2026-10-03T10:00:00.000Z' } } },
  'oyno.discoveryBoards.v1': { guest: [{ id: 'bshelf1', title: 'Synthetic board 7b', question: 'What connects these objects?', promptId: 'connects', cards: [{ type: 'culture_item', id: 'boz-uy-tunduk', titleSnapshot: 'Түндүк' }], links: [], createdAt: AT, updatedAt: '2026-10-02T10:00:00.000Z' }] },
  'oyno.timeCapsules.v1': { guest: [{ id: 'tcshelf1', status: 'sealed', title: 'Synthetic capsule 4c', message: SECRET, articles: [], design: null, openOn: '2027-10-01', createdAt: AT, sealedAt: AT, openedAt: null, openedEarly: false, reflection: '', reflectedAt: null }] },
};

test('filter, search, sort and open three record types; sealed contents never shown', async ({ page, errors }) => {
  await page.setViewportSize({ width: 360, height: 860 });
  await seed(page, { language: 'en', guest: true, storage });
  await page.goto('/profile/shelf');
  const list = page.getByTestId('shelf-list');
  await expect(list).toContainText('Synthetic exhibition 2e');
  await expect(list).toContainText('Synthetic board 7b');
  await expect(list).toContainText('Synthetic capsule 4c');
  await expect(list).toContainText('Sealed until');
  await expect(page.getByText(SECRET)).toHaveCount(0);
  // Designs live in the account: unavailable for a guest - not "empty".
  await expect(page.getByTestId('shelf-unavailable-design')).toContainText('sign in');
  await expect(page.getByTestId('shelf-item-exhibition:uc_shelf')).toContainText('On this device only');
  // Sorted by most recently changed: exhibition (3 Oct), board (2 Oct), capsule (1 Oct).
  const order = await page.locator('[data-testid^="shelf-item-"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')));
  expect(order).toEqual(['shelf-item-exhibition:uc_shelf', 'shelf-item-board:bshelf1', 'shelf-item-capsule:tcshelf1']);
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousViolations(page, 'shelf');

  // Search titles only: words of the sealed message find nothing.
  await page.getByTestId('shelf-search').fill('sealed message');
  await expect(page.getByTestId('shelf-no-match')).toBeVisible();
  await page.getByTestId('shelf-search').fill('board');
  await expect(page.locator('[data-testid^="shelf-item-"]')).toHaveCount(1);
  await page.getByTestId('shelf-search').fill('');
  await page.getByTestId('shelf-filter-capsule').click();
  await expect(page.locator('[data-testid^="shelf-item-"]')).toHaveCount(1);
  await page.getByTestId('shelf-filter-all').click();

  // Each opens its own existing screen.
  await page.getByTestId('shelf-item-board:bshelf1').click();
  await expect(page).toHaveURL(/\/culture\/board\/bshelf1$/);
  await expect(page.getByTestId('board-edit')).toBeVisible();
  await page.goBack();
  await page.getByTestId('shelf-item-capsule:tcshelf1').click();
  await expect(page).toHaveURL(/\/profile\/capsules\/tcshelf1$/);
  await expect(page.getByTestId('capsule-sealed')).toBeVisible();
  await page.goBack();
  await page.getByTestId('shelf-item-exhibition:uc_shelf').click();
  await expect(page).toHaveURL(/\/profile\/my-collections\/museum\?collection=uc_shelf/);
  await expect(page.getByTestId('museum-setup')).toBeVisible();
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('empty categories link to their creation flows (RU)', async ({ page, errors }) => {
  await seed(page, { language: 'ru', guest: true });
  await page.goto('/profile/shelf');
  await expect(page.getByTestId('shelf-empty-board')).toContainText('Досок открытий пока нет');
  await page.getByTestId('shelf-create-capsule').click();
  await expect(page).toHaveURL(/\/profile\/capsules\/new$/);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
