import type { Page } from '@playwright/test';

import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, readStored, seed, test } from '../helpers';

/**
 * Mini Museum Visitor Preview: preview -> open a source -> back (still in
 * preview) -> Return to editing (same place) -> checklist item -> the
 * exhibit in editing. Story preview = the export layout, long text inside
 * the card, at 320 px and in large text.
 */
const AT = '2026-10-01T10:00:00.000Z';
const ID = 'uc_preview_test';
const PRIVATE = 'Private description 3x';
const item = (contentId: string, sortOrder: number) => ({ collectionId: ID, contentType: 'culture_item', contentId, sortOrder, addedAt: AT });
const collections = { guest: { collections: [{ id: ID, name: 'Yurt things', description: PRIVATE, createdAt: AT, updatedAt: AT }], items: [item('boz-uy-tunduk', 0), item('boz-uy-overview', 1), item('removed-from-oyno', 2), item('boz-uy-karkas', 3)] } };
// The longest words a curator can write on a card: 40-character title, 200-character text (KG).
const LONG_TITLE = 'Боз үйдүн эң бийик жериндеги чамгарак ээ'.slice(0, 40);
const LONG_TEXT = 'Түндүк - боз үйдүн эң бийик жериндеги тегерек чамгарак, ал аркылуу жарык кирип, түтүн чыгат; синтетикалык текст, үй-бүлөнүн белгиси катары муундан муунга өтөт деп жазылган мисал 7k.'.slice(0, 200);
const KEYS = ['culture_item:boz-uy-tunduk', 'culture_item:boz-uy-overview', 'culture_item:removed-from-oyno', 'culture_item:boz-uy-karkas'];
const museums = {
  guest: {
    [ID]: {
      title: 'The yurt',
      intro: 'Synthetic introduction 8w',
      exhibits: KEYS,
      captions: { [KEYS[0]]: 'Synthetic caption 4p' },
      reflections: {},
      story: { cards: [{ key: KEYS[0], title: LONG_TITLE, text: LONG_TEXT }, { key: KEYS[1], title: 'Two', text: '' }, { key: KEYS[3], title: '', text: 'Three 5q' }] },
      updatedAt: AT,
    },
  },
};

/** Every descendant of the card lies inside the card's box (nothing hangs off the edge). */
async function expectInsideCard(page: Page) {
  const outside = await page.getByTestId('story-export-card').evaluate((card) => {
    const box = card.getBoundingClientRect();
    return [...card.querySelectorAll('*')]
      .map((node) => ({ id: node.getAttribute('data-testid') ?? node.tagName, rect: node.getBoundingClientRect() }))
      .filter(({ rect }) => rect.height > 0 && (rect.bottom > box.bottom + 0.5 || rect.right > box.right + 0.5 || rect.top < box.top - 0.5 || rect.left < box.left - 0.5))
      .map(({ id }) => id);
  });
  expect(outside).toEqual([]);
}
const scrollTop = (page: Page) => page.getByTestId('museum-scroll').evaluate((node) => node.scrollTop);

for (const width of [320, 412]) {
  test(`preview -> source -> back -> return to editing -> checklist -> edit at ${width}px`, async ({ page, errors }) => {
    await page.setViewportSize({ width, height: 760 });
    await seed(page, { language: 'en', guest: true, storage: { 'oyno.myCollections.v1': collections, 'oyno.myCollections.museums.v1': museums } });
    await page.goto(`/profile/my-collections/${ID}`);
    await page.getByTestId('museum-entry').click();
    const before = await readStored(page, 'oyno.myCollections.museums.v1');

    // Editing position: scrolled down to the preview button.
    await page.getByTestId('museum-preview').scrollIntoViewIfNeeded();
    const editTop = await scrollTop(page);
    expect(editTop).toBeGreaterThan(100);
    await page.getByTestId('museum-preview').click();
    await expect(page.getByTestId('preview-banner')).toContainText('Visitor preview - read-only');
    await expect(page.getByTestId('preview-checklist')).toContainText('Exhibit 3 is no longer available in OYNO');
    await expect(page.getByTestId('preview-checklist')).toContainText('Title, introduction, captions, narration and story words are optional');
    await expectNoSeriousViolations(page, 'preview start');

    // The exhibition, as visitors see it - no private notes, no editing controls.
    await page.getByTestId('preview-start-exhibition').click();
    await expect(page.getByTestId('museum-slide-title')).toBeVisible();
    await expect(page.getByTestId('museum-slide-caption')).toContainText('Synthetic caption 4p');
    await expect(page.getByText(PRIVATE).locator('visible=true')).toHaveCount(0); // (the collection screen below in the stack is hidden)
    await expect(page.locator('[data-testid="museum-title"], [data-testid^="museum-caption-"], [data-testid="museum-share"]')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    // Open the source, come back: still in the preview.
    await page.getByTestId('museum-source-link').click();
    await expect(page).toHaveURL(/\/culture\/item\/boz-uy-tunduk/);
    await page.goBack();
    await expect(page.getByTestId('preview-banner')).toBeVisible();

    // Return to editing: the same place.
    await page.getByTestId('preview-return').click();
    await expect(page.getByTestId('museum-setup')).toBeVisible();
    await expect.poll(() => scrollTop(page)).toBeGreaterThan(editTop - 40);
    expect(Math.abs((await scrollTop(page)) - editTop)).toBeLessThan(40);

    // A checklist item opens the exhibit in editing.
    await page.getByTestId('museum-preview').click();
    await page.locator('[data-testid^="preview-item-unavailable-"]').click();
    await expect(page.getByTestId('museum-setup')).toBeVisible();
    await expect(page.getByTestId('museum-exhibit-2')).toBeInViewport();
    // Edit: remove the unavailable exhibit; the checklist no longer lists it.
    await page.getByTestId('museum-choose-culture_item:removed-from-oyno').click();
    await page.getByTestId('museum-preview').click();
    await expect(page.getByTestId('preview-checklist')).not.toContainText('no longer available');

    // Entering and leaving the preview changed nothing else.
    const after = await readStored<typeof museums>(page, 'oyno.myCollections.museums.v1');
    expect({ ...after!.guest[ID], exhibits: undefined, updatedAt: undefined, story: undefined }).toEqual({ ...(before as typeof museums).guest[ID], exhibits: undefined, updatedAt: undefined, story: undefined, narrations: {}, lookClosely: { exhibits: [], clues: [] }, reflections: {} });
    await expectNoExposedKeys(page);
    expectNoPageErrors(errors);
  });
}

for (const [label, width, storage] of [
  ['320px', 320, {}],
  ['large text', 412, { 'oyno.ageGroup': '6-9' }],
] as const) {
  test(`story preview = export layout; the longest words stay inside the card (${label})`, async ({ page, errors }) => {
    await page.setViewportSize({ width, height: 860 });
    await seed(page, { language: 'kg', guest: true, storage: { 'oyno.myCollections.v1': collections, 'oyno.myCollections.museums.v1': museums, ...storage } });
    await page.goto(`/profile/my-collections/${ID}`);
    await page.getByTestId('museum-entry').click();
    await page.getByTestId('museum-preview').click();
    await page.getByTestId('preview-start-story').click();
    await expect(page.getByTestId('story-export-preview')).toBeVisible();
    await expect(page.getByTestId('story-export-title')).toHaveText(LONG_TITLE);
    await expect(page.getByTestId('story-export-text')).toHaveText(LONG_TEXT);
    await expectInsideCard(page);
    // Not clipped by the card: each text block shows all of its lines.
    for (const id of ['story-export-title', 'story-export-text']) {
      const clipped = await page.getByTestId(id).evaluate((node) => node.scrollHeight > node.clientHeight + 1);
      expect(clipped, id).toBe(false);
    }
    await expect(page.getByText(PRIVATE).locator('visible=true')).toHaveCount(0); // (the collection screen below in the stack is hidden)
    await expect(page.getByTestId('story-export')).toHaveCount(0); // read-only: no export action in the preview
    await expectNoHorizontalOverflow(page);
    await expectNoExposedKeys(page);
    expectNoPageErrors(errors);
  });
}
