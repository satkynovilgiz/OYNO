import { attachBackendLog, expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, LANGUAGES, seed, test } from '../helpers';

test.afterEach(async ({ backend }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) await attachBackendLog(backend, testInfo);
});

/** Screens of the main journeys + the control that must be there on each. */
const SCREENS: { route: string; ready: string }[] = [
  { route: '/home', ready: 'home-screen' },
  { route: '/search', ready: 'search-input' },
  { route: '/culture/item/boz-uy-tunduk', ready: 'culture-item-title' },
  { route: '/learn/boz-uy', ready: 'path-start' },
  { route: '/offline', ready: 'downloads-check' },
];

const offlineManifest = {
  'oyno.offline.manifest': { entries: { 'culture_item:boz-uy-tunduk': { id: 'culture_item:boz-uy-tunduk', kind: 'culture_item', contentId: 'boz-uy-tunduk', queryHashes: ['["culture_item","boz-uy-tunduk"]'], remoteImageUrls: [], downloadedAt: '2026-10-04T10:00:00.000Z', version: 1, requestedBy: ['user'] } } },
};

for (const language of LANGUAGES) {
  test(`${language.toUpperCase()}: main screens render, primary controls present, no raw translation keys`, async ({ page, errors }, testInfo) => {
    await seed(page, { language, guest: true, storage: offlineManifest });
    for (const screen of SCREENS) {
      await page.goto(screen.route);
      await expect(page.getByTestId(screen.ready), `${screen.route} in ${language}`).toBeVisible();
      await expectNoExposedKeys(page);
      await testInfo.attach(`${language}${screen.route.replace(/\//g, '_')}.png`, { body: await page.screenshot(), contentType: 'image/png' });
    }
    // A primary action really works in this language: Downloads check runs.
    await page.goto('/offline');
    await page.getByTestId('downloads-check').click();
    await expect(page.getByTestId('downloads-check-result')).toBeVisible();
    await expectNoExposedKeys(page);
    expectNoPageErrors(errors);
  });
}

test.describe('narrow screen (320 px)', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  for (const language of ['kg', 'ru'] as const) {
    test(`${language.toUpperCase()}: no horizontal overflow on the main screens`, async ({ page, errors }, testInfo) => {
      await seed(page, { language, guest: true, storage: offlineManifest });
      for (const screen of SCREENS) {
        await page.goto(screen.route);
        await expect(page.getByTestId(screen.ready)).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await testInfo.attach(`narrow-${language}${screen.route.replace(/\//g, '_')}.png`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
      }
      expectNoPageErrors(errors);
    });
  }
});

/**
 * Large text: the app's OWN largest settings (Reader text size XL, spacious
 * lines, Larger controls). Browsers can't apply iOS Dynamic Type / Android
 * font scale - that stays a device check (docs/DEVICE_QA.md).
 */
test('large text (Reader XL + Larger controls): article and path stay usable', async ({ page, errors }, testInfo) => {
  await seed(page, {
    language: 'ru',
    guest: true,
    storage: {
      'oyno.readerSettings.v1': { textSize: 'xl', lineSpacing: 'spacious', focusMode: false },
      'oyno.comfort.v1': { reduceMotion: true, haptics: 'standard', largerControls: true, highContrast: false },
    },
  });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/culture/item/boz-uy-overview');
  await expect(page.getByTestId('culture-item-title')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const markRead = page.getByTestId('reading-mark-read');
  await markRead.or(page.getByTestId('reading-completed')).first().scrollIntoViewIfNeeded();
  await testInfo.attach('large-text-article.png', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await page.goto('/learn/boz-uy');
  await expect(page.getByTestId('path-start')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
