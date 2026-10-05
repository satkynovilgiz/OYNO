import { expect, expectNoExposedKeys, expectNoPageErrors, seed, test, waitForStored } from '../helpers';

/**
 * Guided Learning Path journey (browser-supported part). Native game rounds
 * and the 3D result sheet are device checks - see docs/DEVICE_QA.md.
 */

const AT = '2026-10-04T10:00:00.000Z';
const read = (id: string) => ({ [`culture_item:${id}`]: { contentType: 'culture_item', contentId: id, progress: 1, furthest: 1, lastReadAt: AT, completedAt: AT } });
const gotIt = (id: string) => ({ [id]: { glossaryEntryId: id, seenCount: 1, gotItCount: 1, reviewAgainCount: 0, lastReviewedAt: AT, needsReview: false } });

test('finishing an article offers the next INCOMPLETE step, skipping completed ones', async ({ page, errors }) => {
  // The frame article (step 2) is already read -> after the overview the term is next.
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.reading.v1': { guest: read('boz-uy-karkas') } } });
  await page.goto('/learn/boz-uy');
  await expect(page.getByTestId('path-progress')).toHaveAttribute('aria-label', /1\b.*5/);
  await page.getByTestId('path-start').click();
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-overview\?fromPath=boz-uy/);
  // Opening the article completes nothing: no "Continue learning" yet.
  await expect(page.getByTestId('path-return')).toBeVisible();
  await expect(page.getByTestId('path-continue')).toHaveCount(0);

  const markRead = page.getByTestId('reading-mark-read');
  await markRead.or(page.getByTestId('reading-completed')).first().scrollIntoViewIfNeeded();
  if (await markRead.isVisible()) await markRead.click({ timeout: 2000 }).catch(() => undefined);
  await expect(page.getByTestId('reading-completed')).toBeVisible();

  // Next activity's type + title BEFORE navigating.
  const card = page.getByTestId('path-continue');
  await expect(card).toContainText('Learn the term');
  await expect(page.getByTestId('path-continue-next')).toContainText('Түндүк');
  await page.getByTestId('path-continue-go').click();
  await expect(page).toHaveURL(/\/culture\/glossary\/tunduk\?fromPath=boz-uy/);
  await expect(page.getByTestId('path-return')).toBeVisible();
  await expect(page.getByTestId('path-continue')).toHaveCount(0); // seen, not yet "got it"

  // Back to the path: progress preserved (2 of 5).
  await page.getByTestId('path-return').click();
  await expect(page).toHaveURL(/\/learn\/boz-uy/);
  await expect(page.getByTestId('path-progress')).toHaveAttribute('aria-label', /2\b.*5/);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('a direct link or an unrelated path shows no path context', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.reading.v1': { guest: read('boz-uy-overview') } } });
  await page.goto('/culture/item/boz-uy-overview');
  await expect(page.getByTestId('culture-item-title')).toBeVisible();
  await expect(page.getByTestId('path-return')).toHaveCount(0);
  await expect(page.getByTestId('path-continue')).toHaveCount(0);
  // A path this article is not part of.
  await page.goto('/culture/item/boz-uy-overview?fromPath=horse-games');
  await expect(page.getByTestId('culture-item-title')).toBeVisible();
  await expect(page.getByTestId('path-return')).toHaveCount(0);
  await page.goto('/culture/item/boz-uy-overview?fromPath=no-such-path');
  await expect(page.getByTestId('culture-item-title')).toBeVisible();
  await expect(page.getByTestId('path-return')).toHaveCount(0);
  expectNoPageErrors(errors);
});

test('manual step: the card asks for confirmation; last step shows the completion state', async ({ page, errors }) => {
  await seed(page, {
    language: 'en',
    guest: true,
    storage: {
      'oyno.reading.v1': { guest: { ...read('boz-uy-overview'), ...read('boz-uy-karkas') } },
      'oyno.glossaryStudy.v1': { guest: gotIt('tunduk') },
      'oyno.challenges.v1': { daily: null, results: { 'collection:boz-uy-world': { startedAt: AT, completedAt: AT, lastCorrect: 4, lastTotal: 5, bestCorrect: 4, attempts: 1, updatedAt: AT } } },
    },
  });
  // The builder lab has no reliable completion signal -> manual confirmation.
  await page.goto('/learn/boz-uy');
  await expect(page.getByTestId('path-progress')).toHaveAttribute('aria-label', /4\b.*5/);
  // Re-open a finished article from the path: the card offers the lab (not done yet).
  await page.goto('/culture/item/boz-uy-overview?fromPath=boz-uy');
  await expect(page.getByTestId('path-continue-next')).toBeVisible();
  await expect(page.getByTestId('path-continue')).toContainText('Try it yourself');
  // Confirm it where it is offered on the path screen, then the whole path is done.
  await page.getByTestId('path-return').click();
  await page.getByRole('checkbox', { name: 'Mark step complete' }).click();
  await expect(page.getByTestId('path-progress')).toHaveAttribute('aria-label', /5\b.*5/);
  await page.goto('/culture/item/boz-uy-overview?fromPath=boz-uy');
  await expect(page.getByTestId('path-continue-done')).toBeVisible();
  await expect(page.getByTestId('path-continue-portfolio')).toBeVisible();
  await expect(page.getByTestId('path-continue-other')).toContainText('Felt & Oymo');
  await page.getByTestId('path-continue-portfolio').click();
  await expect(page).toHaveURL(/\/profile\/portfolio$/);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('a missing step target is recoverable', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  // Not in the fixture catalogue -> the article screen's not-found state, with a way back.
  await page.goto('/culture/item/horse-kok-boru?fromPath=horse-games');
  await expect(page.getByTestId('not-found')).toBeVisible();
  await page.getByTestId('not-found-back').click();
  await expect(page.getByTestId('not-found')).toHaveCount(0);
  expectNoPageErrors(errors);
});

test('offline: a next step that is not saved says so and offers the way back', async ({ page, context, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/item/boz-uy-overview?fromPath=boz-uy');
  await expect(page.getByTestId('culture-item-title')).toBeVisible();
  await context.setOffline(true);
  const markRead = page.getByTestId('reading-mark-read');
  await markRead.or(page.getByTestId('reading-completed')).first().scrollIntoViewIfNeeded();
  if (await markRead.isVisible()) await markRead.click({ timeout: 2000 }).catch(() => undefined);
  await expect(page.getByTestId('path-continue-next')).toBeVisible();
  // The frame article was never opened or downloaded.
  await expect(page.getByTestId('path-continue-offline')).toBeVisible();
  await expect(page.getByTestId('path-continue-go')).toHaveCount(0);
  await page.getByTestId('path-continue-back').click();
  await expect(page).toHaveURL(/\/learn\/boz-uy/);
  await context.setOffline(false);
  expectNoPageErrors(errors);
});

const challengeDone = { daily: null, results: { 'collection:boz-uy-world': { startedAt: AT, completedAt: AT, lastCorrect: 5, lastTotal: 5, bestCorrect: 5, attempts: 1, updatedAt: AT } } };

test('cold start: the path never shows a guessed progress before the saved one', async ({ page, errors }) => {
  await seed(page, {
    language: 'en',
    guest: true,
    storage: { 'oyno.reading.v1': { guest: { ...read('boz-uy-overview'), ...read('boz-uy-karkas') } }, 'oyno.challenges.v1': challengeDone },
  });
  // Every rendered progress / Start-Continue state, from the first frame on.
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __pathStates: string[] }).__pathStates = seen;
    new MutationObserver(() => {
      const progress = document.querySelector('[data-testid="path-progress"]');
      if (!progress) return;
      const state = `${progress.getAttribute('aria-label')} | ${document.querySelector('[data-testid="path-start"]')?.textContent ?? '-'}`;
      if (seen[seen.length - 1] !== state) seen.push(state);
    }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  });
  await page.goto('/learn/boz-uy');
  await expect(page.getByTestId('path-progress')).toHaveAttribute('aria-label', /3\b.*5/);
  const states = await page.evaluate(() => (window as unknown as { __pathStates: string[] }).__pathStates);
  expect(states, 'before the saved progress loads, the screen shows a loading state - never 0/5 and "Start path"').toEqual(['3 of 5 completed | Continue path']);
  expectNoPageErrors(errors);
});

test('a confirmed manual step survives an app restart', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/learn/boz-uy');
  await expect(page.getByTestId('path-progress')).toHaveAttribute('aria-label', /0\b.*5/);
  await page.getByRole('checkbox', { name: 'Mark step complete' }).click();
  await expect(page.getByTestId('path-progress')).toHaveAttribute('aria-label', /1\b.*5/);
  await waitForStored<Record<string, Record<string, Record<string, string>>>>(page, 'oyno.learningPaths.v1', (saved) => !!saved?.guest?.['boz-uy']?.build, 'manual completion persisted');
  await page.reload();
  await expect(page.getByTestId('path-progress')).toHaveAttribute('aria-label', /1\b.*5/);
  await expect(page.getByRole('checkbox', { name: 'Mark step complete' })).toHaveAttribute('aria-checked', 'true');
  expectNoPageErrors(errors);
});

test('removed content: the step says so, cannot be opened, and Continue moves on to the next step that exists', async ({ page, errors }) => {
  // The Horse Games articles are not in the fixture catalogue (= removed from the content backend).
  await seed(page, { language: 'en', guest: true });
  await page.goto('/learn/horse-games');
  const removed = page.getByRole('button', { name: /^Step 1\. Read: No longer available\.$/ });
  await expect(removed).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('path-next-removed')).toHaveText('Step 1 is no longer available. You can continue with Play: Kok Boru.');
  await page.getByTestId('path-start').click();
  await expect(page).toHaveURL(/\/games\/kok-boru\?fromPath=horse-games/);
  expectNoPageErrors(errors);
});

test('step titles that fail to load offer a retry', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  let failing = true;
  // Served here (before the fake backend) - a failing content request, not an unexpected one.
  await page.route('**/rest/v1/culture_items?*', (route) => (failing ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"unavailable"}' }) : route.fallback()));
  await page.goto('/learn/boz-uy');
  const retry = page.getByTestId('path-catalog-retry');
  await expect(retry).toBeVisible();
  await expect(page.getByRole('button', { name: /^Step 1\. Read: …\./ })).toBeVisible();
  failing = false;
  await retry.click();
  await expect(page.getByRole('button', { name: /^Step 1\. Read: Боз үй\./ })).toBeVisible();
  await expect(retry).toHaveCount(0);
  expect(errors.filter((error) => error.startsWith('pageerror'))).toEqual([]);
});
