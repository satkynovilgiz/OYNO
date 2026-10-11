import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, readStored, seed, test } from '../helpers';

/**
 * Reading Companion: bookmark a named section with a note -> leave ->
 * Culture "Continue reading" -> section notes -> reopen the section (anchor)
 * -> the note is there. A bookmark for a section the article no longer has
 * keeps its note and says so.
 */
test('bookmark -> leave -> continue -> reopen the note', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 760 });
  await seed(page, {
    language: 'en',
    guest: true,
    storage: {
      // An older bookmark for a section this article no longer has (as if the article changed).
      'oyno.sectionBookmarks.v1': { guest: { 'culture_item:boz-uy-tunduk#regional_notes': { contentType: 'culture_item', contentId: 'boz-uy-tunduk', sectionKey: 'regional_notes', articleTitle: 'Түндүк', sectionLabel: 'Regional notes', note: 'Synthetic old note 3c', createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z' } } },
    },
  });
  await page.goto('/culture/item/boz-uy-tunduk');
  const toggle = page.locator('[data-testid^="section-bookmark-"]').last();
  await toggle.scrollIntoViewIfNeeded();
  const sectionKey = ((await toggle.getAttribute('data-testid')) ?? '').replace('section-bookmark-', '');
  expect(sectionKey).not.toBe('regional_notes');
  await toggle.click();
  await page.getByTestId(`section-note-${sectionKey}`).fill('Synthetic section note 8n');
  await page.getByTestId(`section-save-${sectionKey}`).click();
  await expect(page.getByTestId(`section-saved-${sectionKey}`)).toContainText('Your noteSynthetic section note 8n');
  await expectNoSeriousViolations(page, 'article with a bookmark');

  // Leave, then come back through Culture's continue-reading area.
  await page.goto('/culture');
  await page.getByTestId('reading-notes-link').click();
  await expect(page).toHaveURL(/\/profile\/reading-notes$/);
  const entry = page.getByTestId(`reading-note-boz-uy-tunduk-${sectionKey}`);
  await expect(entry).toContainText('Synthetic section note 8n');
  await expect(entry).toContainText('From the article');
  // The changed article: the old note is kept on its own (missing) section, not moved.
  const old = page.getByTestId('reading-note-boz-uy-tunduk-regional_notes');
  await expect(old).toContainText('This section is no longer in the article');
  await expect(old).toContainText('Synthetic old note 3c');
  await expectNoSeriousViolations(page, 'reading notes');

  await page.getByTestId(`reading-note-open-${sectionKey}`).click();
  await expect(page).toHaveURL(new RegExp(`section=${sectionKey}`));
  await expect(page.getByTestId(`section-saved-${sectionKey}`)).toBeInViewport();

  // Delete the outdated bookmark explicitly.
  await page.goto('/profile/reading-notes');
  await page.getByTestId('reading-note-delete-regional_notes').click();
  await expect(page.getByTestId('reading-note-boz-uy-tunduk-regional_notes')).toHaveCount(0);
  const stored = await readStored<Record<string, Record<string, unknown>>>(page, 'oyno.sectionBookmarks.v1');
  expect(Object.keys(stored?.guest ?? {})).toEqual([`culture_item:boz-uy-tunduk#${sectionKey}`]);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('continue reading opens the last section; the position can be cleared (KG)', async ({ page, errors }) => {
  await seed(page, { language: 'kg', guest: true, storage: { 'oyno.reading.v1': { guest: { 'culture_item:boz-uy-tunduk': { contentType: 'culture_item', contentId: 'boz-uy-tunduk', progress: 0.5, furthest: 0.5, lastReadAt: '2026-10-10T10:00:00Z', completedAt: null, lastSectionKey: 'history' } } } } });
  await page.goto('/culture');
  await page.getByTestId('continue-reading').click();
  await expect(page).toHaveURL(/boz-uy-tunduk\?section=history/);
  await page.goto('/culture');
  await page.getByTestId('continue-reading-clear').click();
  await expect(page.getByTestId('continue-reading')).toHaveCount(0);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
