import type { Page } from '@playwright/test';

import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/**
 * Mini Museum narration on web (the native builds can't record yet - see
 * docs/MUSEUM_NARRATION.md). Chromium's FAKE microphone records a test
 * tone; nothing real is captured.
 */
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

async function recordTake(page: Page, ms = 1500) {
  await page.getByTestId('narration-record').click();
  await expect(page.getByTestId('narration-permission')).toContainText('up to 60 seconds');
  await page.getByTestId('narration-allow').click();
  await expect(page.getByTestId('narration-recording')).toBeVisible();
  await page.waitForTimeout(ms);
  await page.getByTestId('narration-stop').click();
  await expect(page.getByTestId('narration-review')).toContainText('not saved yet');
}

test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }, permissions: ['microphone'] });

test.describe('with a (fake) microphone', () => {
  test('record -> preview -> save -> transcript -> replace (discarded) -> visit and play -> restart -> remove the exhibit', async ({ page, errors }) => {
    await seed(page, { language: 'en', guest: true, storage: { 'oyno.myCollections.v1': collections } });
    await page.goto(`/profile/my-collections/${ID}`);
    await page.getByTestId('museum-entry').click();
    await page.getByTestId('museum-narration-0').click();
    await expect(page.getByTestId('narration-storage-note')).toContainText('not included in the learning-data export');

    await recordTake(page);
    expect(await stored(page)).toEqual([]); // nothing saved before "Save recording"
    await page.getByTestId('narration-preview').click();
    await page.getByTestId('narration-save').click();
    await expect(page.getByTestId('narration-saved')).toContainText('is saved on this device');
    const [[first, owner]] = await stored(page);
    expect(owner).toBe('guest');
    await page.getByTestId('narration-text').fill(TRANSCRIPT);

    // A replacement that is discarded leaves the saved one in place.
    await recordTake(page, 800);
    await expect(page.getByTestId('narration-review')).toContainText('stays until this one is saved');
    await page.getByTestId('narration-discard').click();
    expect((await stored(page)).map(([id]) => id)).toEqual([first]);

    // A replacement that is saved removes the old one only then.
    await recordTake(page, 800);
    await page.getByTestId('narration-save').click();
    await expect(page.getByTestId('narration-record')).toBeVisible();
    await expect.poll(async () => (await stored(page)).map(([id]) => id).filter((id) => id !== first).length).toBe(1);
    expect((await stored(page)).map(([id]) => id)).not.toContain(first);

    // Visiting: labelled as the curator's, with the curator's transcript; it plays.
    await page.getByTestId('museum-present').click();
    await expect(page.getByTestId('narration-visitor')).toContainText("Curator's narration");
    await expect(page.getByTestId('narration-visitor-text')).toContainText(`Transcript written by the curator${TRANSCRIPT}`);
    await page.getByTestId('narration-play').click();
    await expect(page.getByTestId('narration-play')).toContainText('Stop');
    await expectNoSeriousViolations(page, 'narration visitor');
    // The next exhibit: the narration stops.
    await page.getByTestId('museum-next').click();
    await expect(page.getByTestId('narration-visitor')).toHaveCount(0);

    // Survives a restart; still playable.
    await page.reload();
    await page.getByTestId('museum-present').click();
    await page.getByTestId('narration-play').click();
    await expect(page.getByTestId('narration-play')).toContainText('Stop');
    await expect(page.getByTestId('narration-missing')).toHaveCount(0);

    // Removing the exhibit deletes its recording.
    await page.goto(`/profile/my-collections/${ID}`);
    await page.getByTestId('museum-entry').click();
    await page.getByTestId('museum-choose-culture_item:boz-uy-tunduk').click();
    await expect.poll(async () => (await stored(page)).length).toBe(0);
    await expectNoExposedKeys(page);
    expectNoPageErrors(errors);
  });
});
