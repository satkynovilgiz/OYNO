import type { Page } from '@playwright/test';

import { expect, expectNoExposedKeys, expectNoPageErrors, readStored, seed, test, waitForStored } from '../helpers';

/**
 * Learning-backup import on web (the file chooser is the browser's). The
 * merge rules, owner binding, concurrency and interruption handling are
 * covered in src/features/settings/dataPrivacy/*.test.ts.
 */

const T1 = '2026-09-01T10:00:00.000Z';
// Synthetic backup - never real user data.
const backup = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    format: 'oyno-learning-data/1',
    schema: 'oyno-learning-export',
    version: 1,
    exportedAt: '2026-10-01T12:00:00.000Z',
    komuzFavorites: ['ak-maral-min', 'kambarkan'],
    weeklyGoal: 5,
    accessToken: 'synthetic-token-should-be-ignored',
    ...overrides,
  });

async function chooseFile(page: Page, text: string, name = 'oyno-learning-data.json') {
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('import-choose').click();
  await (await chooser).setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
}

test('preview shows what will change; importing twice adds nothing the second time', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.komuzLibrary.v1': { guest: { favorites: ['ak-maral-min'] } } } });
  await page.goto('/settings/data-privacy/import');
  await chooseFile(page, backup());
  const plan = page.getByTestId('import-plan');
  await expect(plan).toBeVisible();
  // One favourite is new, one is already here; the weekly goal is new.
  await expect(plan).toContainText('Komuz favorites');
  await expect(plan).toContainText('1 new · 0 updated · 1 already here');
  await expect(plan).toContainText('Weekly goal');
  await expect(page.getByText(/sign-in or account fields found in the file \(1\)/)).toBeVisible();

  await page.getByTestId('import-apply').click();
  await expect(page.getByTestId('import-result')).toBeVisible();
  await expect(page.getByTestId('import-result')).toContainText('1 added · 0 updated');
  await waitForStored<Record<string, { favorites: string[] }>>(page, 'oyno.komuzLibrary.v1', (value) => value?.guest?.favorites.length === 2, 'favourites merged');
  expect(JSON.stringify(await page.evaluate(() => ({ ...localStorage })))).not.toContain('synthetic-token');
  await waitForStored(page, 'oyno.dataImport.pending', (value) => value === null, 'the pending-import marker is cleared after success');

  // Same file again: the preview says nothing changes; the result agrees.
  await page.goto('/settings/data-privacy/import');
  await chooseFile(page, backup());
  await expect(page.getByText('Everything in this backup is already here - importing changes nothing.')).toBeVisible();
  await page.getByTestId('import-apply').click();
  await expect(page.getByText('Everything in this backup was already here.')).toBeVisible();
  expect((await readStored<Record<string, { favorites: string[] }>>(page, 'oyno.komuzLibrary.v1'))!.guest.favorites).toHaveLength(2);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('malformed, newer-version and damaged files are refused and change nothing', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/settings/data-privacy/import');
  const before = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  for (const [text, message] of [
    ['{not json', "isn't valid JSON"],
    [backup({ version: 7 }), 'newer OYNO version'],
    [backup({ komuzFavorites: ['../etc/passwd'] }), 'damaged or unexpected data'],
    [JSON.stringify({ hello: 'world' }), "isn't an OYNO learning-data backup"],
  ] as const) {
    await chooseFile(page, text);
    await expect(page.getByTestId('import-error')).toContainText(message);
  }
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).toBe(before);
  expectNoPageErrors(errors);
});

test('an import that never confirmed it finished is explained on the next visit', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.dataImport.pending': { owner: 'guest', fingerprint: 'abc-1', startedAt: T1 } } });
  await page.goto('/settings/data-privacy/import');
  await expect(page.getByTestId('import-interrupted')).toContainText('may not have finished');
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByTestId('import-interrupted')).toHaveCount(0);
  await waitForStored(page, 'oyno.dataImport.pending', (value) => value === null, 'dismiss clears the marker');
  expectNoPageErrors(errors);
});
