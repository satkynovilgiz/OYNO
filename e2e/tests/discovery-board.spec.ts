import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, readStored, seed, test } from '../helpers';

/**
 * Culture Discovery Board: article -> "Explore a question" -> neutral prompt
 * -> add an article -> attach a SOURCED connection (evidence, article,
 * section) -> open its source and come back -> a personal observation ->
 * review as a list -> reopen after a restart.
 */
for (const width of [320, 412]) {
  test(`create, evidence, source and back, observation, reopen at ${width}px`, async ({ page, errors }) => {
    await page.setViewportSize({ width, height: 860 });
    await seed(page, { language: 'en', guest: true });
    await page.goto('/culture/item/boz-uy-tunduk');
    await page.getByTestId('board-from-article').click();
    await expect(page).toHaveURL(/\/culture\/board\?from=culture_item/);
    await expect(page.getByTestId('board-create')).toBeDisabled();
    await page.getByTestId('board-prompt-connects').click();
    await page.getByTestId('board-create').click();
    await expect(page).toHaveURL(/\/culture\/board\/b/);

    // Add an article the dataset links to, then attach the sourced connection.
    await page.getByTestId('board-suggest-boz-uy-karkas').click();
    await expect(page.getByTestId('board-card-1')).toBeVisible();
    await page.getByTestId('board-attach-tunduk-part-of-karkas').click();
    const sourced = page.getByTestId('board-sourced-tunduk-part-of-karkas');
    await expect(sourced).toContainText("From OYNO's connections");
    await expect(sourced).toContainText('“Кереге (дубал каркасы), уук (чатыр таякчалары), түндүк”');
    await expect(page.getByTestId('board-evidence-source-tunduk-part-of-karkas')).toContainText('From:');
    await expectNoHorizontalOverflow(page);

    // A half-written observation survives opening the source and coming back.
    await page.getByTestId('board-note').fill('Synthetic observation 9z');
    await page.getByTestId('board-open-source-tunduk-part-of-karkas').click();
    await expect(page).toHaveURL(/\/culture\/item\/boz-uy-karkas/);
    await page.goBack();
    await expect(page.getByTestId('board-note')).toHaveValue('Synthetic observation 9z');
    await expect(page.getByTestId('board-sourced-tunduk-part-of-karkas')).toBeVisible();
    await page.getByTestId('board-note-card-0').click();
    await page.getByTestId('board-note-save').click();
    await expect(page.locator('[data-testid^="board-observation-"]')).toContainText('Your observation');

    // Review as a readable list.
    await page.getByTestId('board-mode-review').click();
    await expect(page.getByTestId('board-review')).toContainText('What connects these objects?');
    await expect(page.getByTestId('board-review-card-1')).toContainText('2.');
    await expect(page.getByTestId('board-review')).toContainText("From OYNO's connections");
    await expect(page.getByTestId('board-review')).toContainText('Your observation');
    await expectNoSeriousViolations(page, 'board review');

    // Restart: reopen from the list.
    const stored = await readStored<Record<string, { id: string; links: unknown[] }[]>>(page, 'oyno.discoveryBoards.v1');
    expect(stored?.guest?.[0].links).toHaveLength(2);
    await page.goto('/culture/board');
    await page.locator('[data-testid^="board-open-"]').first().click();
    await expect(page.getByTestId('board-sourced-tunduk-part-of-karkas')).toBeVisible();
    await expect(page.locator('[data-testid^="board-observation-"]')).toContainText('Synthetic observation 9z');
    await expectNoExposedKeys(page);
    expectNoPageErrors(errors);
  });
}

test('an unavailable article is marked and its notes kept (KG)', async ({ page, errors }) => {
  const board = {
    id: 'bsynthetic1',
    title: 'Synthetic board',
    question: 'Synthetic question 4r',
    promptId: null,
    cards: [
      { type: 'culture_item', id: 'boz-uy-tunduk', titleSnapshot: 'Tunduk' },
      { type: 'culture_item', id: 'removed-from-oyno', titleSnapshot: 'A removed article 6j' },
    ],
    links: [{ id: 'l1', kind: 'observation', text: 'Note on the removed one 2p', cards: ['culture_item:removed-from-oyno'] }],
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
  };
  await seed(page, { language: 'kg', guest: true, storage: { 'oyno.discoveryBoards.v1': { guest: [board] } } });
  await page.goto('/culture/board/bsynthetic1');
  await expect(page.getByTestId('board-card-unavailable-1')).toBeVisible();
  await expect(page.getByTestId('board-card-1')).toContainText('A removed article 6j');
  await expect(page.getByTestId('board-observation-l1')).toContainText('Note on the removed one 2p');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
