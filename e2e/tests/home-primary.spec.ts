import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, LANGUAGES, seed, test } from '../helpers';

/** Home: Discover / Create / Continue. One Continue card of REAL unfinished work; honest states otherwise. */
const FAKE_SUPABASE = 'https://oyno-e2e.test';
const reading = (id: string) => ({ [`culture_item:${id}`]: { contentType: 'culture_item', contentId: id, progress: 0.4, furthest: 0.45, lastReadAt: '2026-10-10T10:00:00Z', completedAt: null } });
const draft = { v: 1, target: 'new', entryId: 'e-new-1', fields: { title: 'Private memory title', note: '', date: '2026-10-01', photoUri: null, link: null }, baseUpdatedAt: null, savedAt: '2026-10-01T00:00:00Z' };

test('a new person sees where to begin; Discover and Create open their destinations', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await seed(page, { language: 'en', guest: true });
  await page.goto('/home');
  const primary = page.getByTestId('home-primary');
  await expect(primary).toContainText('Where to begin');
  await expect(page.getByTestId('home-primary-discover')).toContainText('Start here');
  await expect(page.getByTestId('home-continue-empty-new')).toContainText('Nothing to continue yet');
  await expect(page.getByTestId('home-destinations')).toBeVisible();
  await expectNoSeriousViolations(page, 'home primary (new)');
  await page.screenshot({ path: 'e2e/.results/home-primary-new.png' });

  await page.getByTestId('home-primary-discover').click();
  await expect(page).toHaveURL(/\/culture$/);
  await page.goBack();
  await page.getByTestId('home-primary-create').locator('visible=true').click();
  await expect(page).toHaveURL(/\/create$/);
  await expect(page.getByTestId('create-hub')).toContainText('Make something');
  await expectNoSeriousViolations(page, 'create hub');
  await page.getByTestId('create-hub-oymo').click();
  await expect(page).toHaveURL(/\/culture\/oymo\/create/);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('a returning reader continues the unfinished article', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.reading.v1': { guest: reading('boz-uy-tunduk') } } });
  await page.goto('/home');
  const card = page.getByTestId('home-continue-reading');
  await expect(card).toContainText('Түндүк');
  await expect(card).toContainText('45%');
  await expect(page.getByTestId('home-primary')).toContainText('What would you like to do?');
  await page.screenshot({ path: 'e2e/.results/home-primary-reading.png' });
  await page.getByTestId('home-continue-open').click();
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-tunduk/);
  expectNoPageErrors(errors);
});

test('unsaved work comes first and is named by kind, never by its private text', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.reading.v1': { guest: reading('boz-uy-tunduk') }, 'oyno.journal.drafts.v1': { guest: { new: draft } } } });
  await page.goto('/home');
  const card = page.getByTestId('home-continue-unsaved');
  await expect(card).toContainText('Journal draft');
  await expect(card).not.toContainText('Private memory title');
  await expect(page.getByTestId('home-continue-reading')).toHaveCount(0);
  await page.getByTestId('home-continue-open').click();
  await expect(page).toHaveURL(/\/journal\/new/);
  expectNoPageErrors(errors);
});

test("another owner's work is not continued", async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.reading.v1': { 'user-x': reading('boz-uy-tunduk') }, 'oyno.journal.drafts.v1': { 'user-x': { new: draft } } } });
  await page.goto('/home');
  await expect(page.getByTestId('home-continue-empty-new')).toBeVisible();
  expectNoPageErrors(errors);
});

test('failed content loading never leaves Home blank', async ({ page, errors }) => {
  await page.route(`${FAKE_SUPABASE}/rest/v1/**`, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"down"}' }));
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.reading.v1': { guest: reading('boz-uy-tunduk') } } });
  await page.goto('/home');
  await expect(page.getByTestId('home-primary-discover')).toBeVisible();
  await expect(page.getByTestId('home-primary-create')).toBeVisible();
  // The article can't be resolved, so it is not offered - an honest empty state instead of a broken card.
  await expect(page.getByTestId('home-continue-empty-returning')).toBeVisible();
  // Failed requests are expected here; only page errors count.
  expectNoPageErrors(errors);
});

for (const language of LANGUAGES) {
  test(`narrow screen, larger controls, long ${language.toUpperCase()} text: no overflow`, async ({ page, errors }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await seed(page, { language, guest: true, storage: { 'oyno.comfort.v1': { reduceMotion: true, haptics: 'standard', largerControls: true, highContrast: false }, 'oyno.reading.v1': { guest: reading('boz-uy-tunduk') } } });
    await page.goto('/home');
    await expect(page.getByTestId('home-continue-reading')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoExposedKeys(page);
    await page.screenshot({ path: `e2e/.results/home-primary-320-${language}.png`, fullPage: false });
    await page.goto('/create');
    await expect(page.getByTestId('create-hub-shelf')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoExposedKeys(page);
    expectNoPageErrors(errors);
  });
}
