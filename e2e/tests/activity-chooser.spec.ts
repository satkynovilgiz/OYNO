import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Home activity chooser: every suggestion opens its own screen; offline suggestions work offline; honest fallbacks. */

const EXPECTED: Record<string, RegExp> = {
  daily: /\/daily$/,
  detective: /\/culture\/detective$/,
  mapChallenge: /\/explore\/map-challenge$/,
  jaaAtuu: /\/games\/jaa-atuu$/,
  kyzKuumai: /\/games\/kyz-kuumai$/,
  kokBoru: /\/games\/kok-boru$/,
  duel: /\/culture\/duel$/,
  restore: /\/culture\/oymo\/restore$/,
  bozUy: /\/culture\/boz-uy\/build$/,
  shyrdak: /\/culture\/shyrdak\/create$/,
  oymo: /\/culture\/oymo\/create$/,
  komuzListen: /\/culture\/komuz\/listen$/,
  repeatRhythm: /\/culture\/komuz\/repeat$/,
  komuzLesson: /\/culture\/komuz\/learn$/,
};

test('from Home: every suggestion opens the right screen', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/home');
  await page.getByTestId('chooser-entry').click();
  await expect(page).toHaveURL(/\/activities$/);
  const opened = new Set<string>();
  for (const interest of ['discover', 'play', 'create', 'listen']) {
    await page.getByTestId('chooser-time-10').click();
    await page.getByTestId(`chooser-interest-${interest}`).click();
    for (let pageIndex = 0; pageIndex < 2; pageIndex += 1) {
      const cards = page.locator('[data-testid^="chooser-suggestion-"]');
      await expect(cards.first()).toBeVisible();
      const idsOnPage = await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')!.replace('chooser-suggestion-', '')));
      expect(idsOnPage.length).toBeLessThanOrEqual(3);
      for (const id of idsOnPage) {
        if (opened.has(id)) continue;
        await page.getByTestId(`chooser-suggestion-${id}`).click();
        await expect(page).toHaveURL(EXPECTED[id]);
        opened.add(id);
        await page.goBack();
        await expect(page).toHaveURL(/\/activities$/);
        // The choice survives coming back (same screen state).
        await expect(page.getByTestId(`chooser-interest-${interest}`)).toHaveAttribute('aria-checked', 'true');
      }
      if ((await page.getByTestId('chooser-more').count()) === 0) break;
      await page.getByTestId('chooser-more').click();
    }
  }
  expect([...opened].sort()).toEqual(Object.keys(EXPECTED).sort());
  expectNoPageErrors(errors);
});

test('estimates and plain explanations; an honest fallback when nothing fits', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/activities');
  await page.getByTestId('chooser-time-5').click();
  await page.getByTestId('chooser-interest-create').click();
  await expect(page.getByTestId('chooser-suggestion-shyrdak')).toContainText('A short creative activity.');
  await expect(page.getByTestId('chooser-suggestion-shyrdak')).toContainText('About 5 min (estimate: colours, a pattern and a border)');
  // Nothing to listen to in 2 minutes: say so, and offer the shortest real option.
  await page.getByTestId('chooser-time-2').click();
  await page.getByTestId('chooser-interest-listen').click();
  await expect(page.getByTestId('chooser-empty-needsMoreTime')).toContainText('Komuz Listening Room, about 3 min');
  await page.getByTestId('chooser-shortest').click();
  await expect(page).toHaveURL(/\/culture\/komuz\/listen$/);
  expectNoPageErrors(errors);
});

test('offline: only activities that open offline, and they do', async ({ page, context, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/activities');
  await expect(page.getByTestId('chooser-time-5')).toBeVisible();
  await context.setOffline(true);
  await page.getByTestId('chooser-time-5').click();
  await page.getByTestId('chooser-interest-create').click();
  const card = page.getByTestId('chooser-suggestion-bozUy');
  await expect(card).toContainText('Works offline');
  await card.click();
  await expect(page).toHaveURL(/\/culture\/boz-uy\/build$/);
  await expect(page.getByText('Building a boz üy')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next step' })).toBeVisible();
  await context.setOffline(false);
  expectNoPageErrors(errors);
});

test('KG and RU translated; accessible', async ({ page, errors }) => {
  for (const language of ['kg', 'ru'] as const) {
    await seed(page, { language, guest: true });
    await page.goto('/activities');
    await page.getByTestId('chooser-time-5').click();
    await page.getByTestId('chooser-interest-play').click();
    await expect(page.getByTestId('chooser-results')).toBeVisible();
    await expectNoExposedKeys(page);
  }
  expectNoPageErrors(errors);
});

test('accessible chooser', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/activities');
  await page.getByTestId('chooser-time-10').click();
  await page.getByTestId('chooser-interest-discover').click();
  await expectNoSeriousViolations(page, 'activity chooser');
  expectNoPageErrors(errors);
});
