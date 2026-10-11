import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, readStored, seed, test } from '../helpers';

/**
 * Listening Notebook in the Komuz Listening Room, with the REAL bundled
 * recording playing in the existing player: save a moment -> write a note
 * -> reopen the room -> the note is there -> tap the moment -> the player
 * is at that point.
 */
test('save moment -> edit note -> reopen -> seek', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/komuz/listen');
  await page.getByRole('button', { name: /^Play / }).first().click();
  // Wait until the recording has really advanced a little.
  await expect(page.getByTestId('notebook-save-moment')).toHaveText(/\(0:0[2-9]\)/, { timeout: 15_000 });
  await page.getByTestId('notebook-save-moment').click();
  const note = page.locator('[data-testid^="notebook-note-m"]').first();
  await note.fill('Synthetic observation 4k');
  await page.locator('[data-testid^="notebook-save-note-"]').first().click();
  await expect(page.locator('[data-testid^="notebook-note-text-"]').first()).toHaveText('Synthetic observation 4k');
  const stored = await readStored<Record<string, Record<string, { seconds: number; trackId: string }>>>(page, 'oyno.listeningNotebook.v1');
  const [moment] = Object.values(stored?.guest ?? {});
  expect(moment.seconds).toBeGreaterThanOrEqual(2);
  await expectNoSeriousViolations(page, 'listening notebook');

  // Reopen (a restart): the note is still there; let the recording run past the moment, then go back to it.
  await page.reload();
  await expect(page.locator('[data-testid^="notebook-note-text-"]').first()).toHaveText('Synthetic observation 4k');
  await page.getByRole('button', { name: /^Play / }).first().click();
  await expect(page.getByTestId('notebook-save-moment')).toHaveText(/\(0:(0[2-9]|[1-5]\d)\)/, { timeout: 15_000 });
  await page.waitForTimeout(Math.max(0, (moment.seconds + 3) * 1000 - 2000));
  await page.locator('[data-testid^="notebook-go-"]').first().click();
  const expected = Math.floor(moment.seconds);
  await expect(page.getByTestId('notebook-save-moment')).toHaveText(new RegExp(`\\(0:0?(${expected}|${expected + 1})\\)`), { timeout: 5_000 });
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('a missing recording keeps its note (RU)', async ({ page, errors }) => {
  await seed(page, { language: 'ru', guest: true, storage: { 'oyno.listeningNotebook.v1': { guest: { mgone01: { id: 'mgone01', trackId: 'removed-recording', seconds: 12, titleSnapshot: 'Удалённая запись', note: 'Synthetic kept note 6w', createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z' } } } } });
  await page.goto('/culture/komuz/listen');
  await expect(page.getByTestId('notebook-track-removed-recording')).toContainText('Эта запись сейчас недоступна');
  await expect(page.getByTestId('notebook-note-text-mgone01')).toHaveText('Synthetic kept note 6w');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
