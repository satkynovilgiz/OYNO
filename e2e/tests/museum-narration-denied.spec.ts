import type { Page } from '@playwright/test';

import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Mini Museum narration when the microphone is NOT available (no device / not allowed): written narration only. */
const AT = '2026-10-01T10:00:00.000Z';
const ID = 'uc_narration_test';
const item = (contentId: string, sortOrder: number) => ({ collectionId: ID, contentType: 'culture_item', contentId, sortOrder, addedAt: AT });
const collections = { guest: { collections: [{ id: ID, name: 'Yurt things', description: null, createdAt: AT, updatedAt: AT }], items: [item('boz-uy-tunduk', 0), item('boz-uy-overview', 1)] } };
const TRANSCRIPT = 'Synthetic transcript about the crown 2v';

/** Recordings in the device store, as [id, owner]. */
const stored = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<[string, string][]>((resolve) => {
        const open = indexedDB.open('oyno-narrations', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('recordings', { keyPath: 'id' });
        open.onsuccess = () => {
          const request = open.result.transaction('recordings', 'readonly').objectStore('recordings').getAll();
          request.onsuccess = () => {
            resolve((request.result as { id: string; owner: string }[]).map((record) => [record.id, record.owner]));
            open.result.close();
          };
        };
      }),
  );

test('microphone denied: explained, nothing recorded, written narration still works (RU)', async ({ page, context, errors }) => {
  await context.clearPermissions();
  await seed(page, { language: 'ru', guest: true, storage: { 'oyno.myCollections.v1': collections } });
  await page.goto(`/profile/my-collections/${ID}`);
  await page.getByTestId('museum-entry').click();
  await page.getByTestId('museum-narration-0').click();
  await page.getByTestId('narration-record').click();
  await page.getByTestId('narration-allow').click();
  await expect(page.getByTestId('narration-denied')).toContainText('Доступ к микрофону не разрешён');
  await page.getByTestId('narration-text').fill('Письменный рассказ 5k');
  await page.getByTestId('museum-present').click();
  await expect(page.getByTestId('narration-visitor')).toContainText('Рассказ куратора');
  await expect(page.getByTestId('narration-visitor-text')).toContainText('Написано куратором');
  await expect(page.getByTestId('narration-play')).toHaveCount(0);
  expect(await stored(page)).toEqual([]);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
