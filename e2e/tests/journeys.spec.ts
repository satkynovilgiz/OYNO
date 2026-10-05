import { expect, expectNoExposedKeys, expectNoPageErrors, seed, test, waitForStored } from '../helpers';

test('guest onboarding reaches Home', async ({ page, errors }) => {
  await seed(page, { language: 'kg' });
  await page.goto('/');
  await page.getByTestId('language-en').click();
  await page.getByTestId('language-continue').click();
  await expect(page).toHaveURL(/\/onboarding$/);
  // "Explore as guest" is offered on the last slide (account creation is never forced first).
  // The pager ignores a tap while its scroll animation settles (400 ms guard), so under load a
  // Next can be dropped: retry until the last slide, never tapping there (Next becomes "Start").
  const guest = page.getByTestId('onboarding-guest');
  await expect(async () => {
    if (!(await guest.isVisible())) await page.getByTestId('onboarding-next').click();
    await expect(guest).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  await guest.click();
  await expect(page).toHaveURL(/\/age-group$/);
  await page.getByTestId('age-18+').click();
  await page.getByTestId('age-continue').click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('search finds a culture article and opens it', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/search');
  await page.getByTestId('search-input').fill('Түндүк');
  await page.getByTestId('search-result-culture_item-boz-uy-tunduk').click();
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-tunduk$/);
  await expect(page.getByTestId('culture-item-title')).toHaveText('Түндүк');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('start a learning path, complete a step, reopen its progress (survives reload)', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/learn/boz-uy');
  const progress = page.getByTestId('path-progress');
  await expect(progress).toHaveAttribute('aria-label', /0\b.*5/);
  await expect(page.getByTestId('path-start')).toContainText('Start');
  await page.getByTestId('path-start').click();
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-overview/);
  // Finish the article: reading to the end completes it; "Mark as read" is the
  // explicit alternative when it is still offered.
  const done = page.getByTestId('reading-completed');
  const markRead = page.getByTestId('reading-mark-read');
  await markRead.or(done).first().scrollIntoViewIfNeeded();
  // Scrolling may complete the article first and remove the button - either way is fine.
  if (await markRead.isVisible()) await markRead.click({ timeout: 2000 }).catch(() => undefined);
  await expect(done).toBeVisible();
  // Back to the path with the in-app "Back to Learning Path" pill.
  await page.getByTestId('path-return').click();
  await expect(page).toHaveURL(/\/learn\/boz-uy/);
  await expect(page.getByTestId('path-progress')).toHaveAttribute('aria-label', /1\b.*5/);
  await expect(page.getByTestId('path-start')).toContainText('Continue');
  // Reading progress is saved with a short debounce: wait for the STORED completion, then reload.
  await waitForStored<Record<string, Record<string, { contentId: string; completedAt?: string | null }>>>(
    page,
    'oyno.reading.v1',
    (saved) => Object.values(saved?.guest ?? {}).some((record) => record.contentId === 'boz-uy-overview' && !!record.completedAt),
    'guest reading progress for boz-uy-overview is persisted as completed',
  );
  await page.reload();
  await expect(page.getByTestId('path-progress')).toHaveAttribute('aria-label', /1\b.*5/);
  expectNoPageErrors(errors);
});

const round = (id: string, minute: number, practice: boolean, primary: number) => ({ id, gameId: 'jaa_atuu', completedAt: `2026-10-0${minute}T10:00:00.000Z`, practice, result: 'completed', primary, secondary: {} });
const GAME_RECORDS = {
  guest: {
    recent: { jaa_atuu: [round('r4', 4, true, 120), round('r3', 3, false, 51), round('r2', 2, true, 110), round('r1', 1, false, 42)] },
    best: { jaa_atuu: 51 },
    sessions: { jaa_atuu: 4 },
    wins: {},
    official: { jaa_atuu: 2 },
  },
};

test('game statistics: open a game and switch filters (official / practice kept apart)', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.gameRecords.v1': GAME_RECORDS } });
  await page.goto('/games/stats');
  await page.getByTestId('game-stats-row-jaa_atuu').click();
  await expect(page).toHaveURL(/\/games\/stats\/jaa_atuu$/);
  await expect(page.getByTestId('stats-group-official')).toBeVisible();
  await expect(page.getByTestId('stats-group-practice')).toHaveCount(0);
  await page.getByTestId('stats-filter-all').click();
  await expect(page.getByTestId('stats-group-official')).toBeVisible();
  await expect(page.getByTestId('stats-group-practice')).toBeVisible();
  await page.getByTestId('stats-filter-practice').click();
  await expect(page.getByTestId('stats-group-official')).toHaveCount(0);
  await expect(page.getByTestId('stats-group-practice')).toContainText('115');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

const hash = (key: unknown[]) => JSON.stringify(key);
const entry = (id: string) => ({ id: `culture_item:${id}`, kind: 'culture_item', contentId: id, queryHashes: [hash(['culture_item', id])], remoteImageUrls: [], downloadedAt: '2026-10-04T10:00:00.000Z', version: 1, requestedBy: ['user'] });

test('Downloads: "Check downloads" separates ready from incomplete', async ({ page, errors }) => {
  await seed(page, {
    language: 'en',
    guest: true,
    storage: {
      'oyno.offline.manifest': { entries: { 'culture_item:boz-uy-overview': entry('boz-uy-overview'), 'culture_item:boz-uy-tunduk': entry('boz-uy-tunduk') } },
      // Only the overview's data is really stored; the Tündük entry is incomplete.
      [`oyno.offline.query:${hash(['culture_item', 'boz-uy-overview'])}`]: { key: ['culture_item', 'boz-uy-overview'], data: { id: 'boz-uy-overview', title: 'Боз үй' }, savedAt: 1759572000000 },
    },
  });
  await page.goto('/offline');
  await page.getByTestId('downloads-check').click();
  await expect(page.getByTestId('downloads-check-result')).toContainText('1 ready offline');
  await expect(page.getByTestId('downloads-check-result')).toContainText('1 incomplete');
  await expect(page.getByTestId('downloads-needs-repair')).toBeVisible();
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

for (const route of ['/culture/item/does-not-exist', '/learn/no-such-path', '/games/stats/no-such-game']) {
  test(`invalid id shows a recoverable not-found state: ${route}`, async ({ page, errors }) => {
    await seed(page, { language: 'en', guest: true });
    await page.goto(route);
    await expect(page.getByTestId('not-found')).toBeVisible();
    await page.getByTestId('not-found-back').click();
    await expect(page.getByTestId('not-found')).toHaveCount(0);
    expectNoPageErrors(errors);
  });
}
