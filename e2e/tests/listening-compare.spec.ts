import type { Page } from '@playwright/test';

import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, readStored, seed, test } from '../helpers';

/** Listening Compare with the REAL bundled recordings in the existing single player: A -> B -> moments + note -> reopen. */
const seconds = async (page: Page, side: 'a' | 'b') => {
  const text = (await page.getByTestId(`compare-time-${side}`).textContent()) ?? '';
  const [m, s] = text.split('/')[0].trim().split(':').map(Number);
  return m * 60 + s;
};

test('A -> B -> save observations -> reopen', async ({ page, errors }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 412, height: 900 });
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/komuz/listen');
  await page.getByTestId('compare-entry').click();
  await page.getByTestId('compare-pick-a-ak-maral-min').click();
  await page.getByTestId('compare-pick-b-kokoy-kesti').click();
  await expect(page.getByTestId('compare-pick-b-ak-maral-min')).toBeDisabled(); // two different recordings
  await page.getByTestId('compare-begin').click();
  await expect(page).toHaveURL(/\/culture\/komuz\/compare\/c-/);

  // A plays; save a moment from A.
  await page.getByTestId('compare-switch-a').click();
  await expect(page.getByTestId('compare-time-a')).toHaveText(/^0:0[3-9]/, { timeout: 15_000 });
  await page.getByTestId('compare-save-moment-a').click();
  await expect(page.getByTestId('compare-moment-a')).toContainText('Your moment: 0:0');
  const aAt = await seconds(page, 'a');

  // Switch: A stops (one player), B starts from its own beginning.
  await page.getByTestId('compare-switch-b').click();
  await expect(page.getByTestId('compare-time-a')).toHaveCount(0);
  await expect(page.getByTestId('compare-side-a')).toContainText(/Not playing\. Its place: 0:0[3-9]/);
  await expect(page.getByTestId('compare-time-b')).toHaveText(/^0:0[2-9]/, { timeout: 15_000 });
  await page.getByTestId('compare-save-moment-b').click();
  await expect(page.getByTestId('compare-moment-b')).toBeVisible();

  // Saving the note doesn't restart playback.
  const beforeNote = await seconds(page, 'b');
  await page.getByTestId('compare-note').fill('Synthetic observation: B sounds busier to me.');
  await page.getByTestId('compare-save-note').click();
  await expect(page.getByTestId('compare-save-note')).toBeDisabled();
  expect(await seconds(page, 'b')).toBeGreaterThanOrEqual(beforeNote);
  await expect(page.getByTestId('compare-session')).toContainText('not facts about the music');
  await expectNoSeriousViolations(page, 'listening compare');

  // Back to A: it continues from its own place, not from 0.
  await page.getByTestId('compare-switch-a').click();
  await expect.poll(() => seconds(page, 'a'), { timeout: 10_000 }).toBeGreaterThanOrEqual(aAt);

  // Reopen after a restart: both moments and the note are there; go to A's moment.
  await page.reload();
  await expect(page.getByTestId('compare-note')).toHaveValue('Synthetic observation: B sounds busier to me.');
  await expect(page.getByTestId('compare-moment-a')).toBeVisible();
  await expect(page.getByTestId('compare-moment-b')).toBeVisible();
  await page.getByTestId('compare-go-a').click();
  await expect(page.getByTestId('compare-time-a')).toBeVisible({ timeout: 10_000 });
  const stored = await readStored<Record<string, Record<string, { moments: { a?: { momentId: string } } }>>>(page, 'oyno.listeningCompare.v1');
  const notebook = await readStored<Record<string, Record<string, unknown>>>(page, 'oyno.listeningNotebook.v1');
  const [comparison] = Object.values(stored!.guest);
  expect(Object.keys(notebook!.guest)).toContain(comparison.moments.a!.momentId); // the moment is in the Notebook too
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('a missing recording keeps the moment and the note (RU)', async ({ page, errors }) => {
  const c = { id: 'c-1', a: { trackId: 'ak-maral-min', title: 'Ак марал мин' }, b: { trackId: 'removed-recording', title: 'Удалённая запись' }, moments: { b: { momentId: 'mgone01', seconds: 20 } }, note: 'Synthetic kept comparison 7q', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };
  await seed(page, { language: 'ru', guest: true, storage: { 'oyno.listeningCompare.v1': { guest: { 'c-1': c } } } });
  await page.goto('/culture/komuz/compare/c-1');
  await expect(page.getByTestId('compare-missing-b')).toContainText('сейчас недоступна');
  await expect(page.getByTestId('compare-moment-b')).toContainText('0:20');
  await expect(page.getByTestId('compare-go-b')).toHaveCount(0);
  await expect(page.getByTestId('compare-note')).toHaveValue('Synthetic kept comparison 7q');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
