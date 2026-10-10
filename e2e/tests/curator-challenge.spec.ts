import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, readStored, seed, test } from '../helpers';

/**
 * Curator Challenge: prompt -> articles (search + dataset suggestions) ->
 * sourced connection -> open a source and come back -> Visitor Preview ->
 * checklist -> save as a normal exhibition -> reopen in Mini Museum.
 */
for (const width of [320, 412]) {
  test(`challenge -> source -> preview -> save -> reopen at ${width}px`, async ({ page, errors }) => {
    await page.setViewportSize({ width, height: 860 });
    await seed(page, { language: 'en', guest: true });
    await page.goto('/profile/my-collections');
    await page.getByTestId('challenge-entry').click();
    await expect(page.getByTestId('challenge-start')).toContainText('not facts about culture');
    await page.getByTestId('challenge-prompt-story').click();

    await page.getByTestId('challenge-name').fill('Synthetic yurt story 5d');
    await page.getByTestId('challenge-search').fill('Түн');
    await page.getByTestId('challenge-add-boz-uy-tunduk').click();
    await page.getByTestId('challenge-suggest-boz-uy-karkas').click();
    await expect(page.getByTestId('challenge-connection-tunduk-part-of-karkas')).toContainText("From OYNO's connections");
    await page.getByTestId('challenge-suggest-boz-uy-overview').click();
    await page.getByTestId('challenge-caption-0').fill('Synthetic caption 2s');
    await expect(page.getByTestId('challenge-req-intro')).toContainText('Write an introduction.');
    await expect(page.getByTestId('challenge-save')).toBeDisabled();
    // Changing the prompt keeps the work.
    await page.getByTestId('challenge-switch-compare').click();
    await expect(page.getByTestId('challenge-caption-0')).toHaveValue('Synthetic caption 2s');
    await page.getByTestId('challenge-switch-story').click();
    await expectNoHorizontalOverflow(page);

    // Open a source and come back: everything is still there.
    await page.getByTestId('challenge-source-1').click();
    await expect(page).toHaveURL(/\/culture\/item\/boz-uy-karkas/);
    await page.goBack();
    await expect(page.getByTestId('challenge-pick-2')).toBeVisible();
    await expect(page.getByTestId('challenge-caption-0')).toHaveValue('Synthetic caption 2s');

    // The checklist item leads to the introduction; write it.
    await page.getByTestId('challenge-req-intro').click();
    await page.getByTestId('challenge-intro').fill('Synthetic introduction 7p');
    await expect(page.getByTestId('challenge-save')).toBeEnabled();

    // Visitor Preview: the real guided tour, read-only; back to the same draft.
    await page.getByTestId('challenge-preview').click();
    await expect(page.getByTestId('challenge-preview-banner')).toBeVisible();
    await expect(page.getByTestId('tour-intro')).toContainText('Synthetic introduction 7p');
    await expectNoSeriousViolations(page, 'challenge preview');
    await page.getByTestId('challenge-preview-return').click();
    await expect(page.getByTestId('challenge-intro')).toHaveValue('Synthetic introduction 7p');

    await page.getByTestId('challenge-save').click();
    await expect(page).toHaveURL(/\/profile\/my-collections\/museum/);
    await expect(page.getByTestId('museum-setup')).toBeVisible();
    await expect(page.getByTestId('museum-intro')).toHaveValue('Synthetic introduction 7p');
    await expect(page.getByTestId('museum-caption-0')).toHaveValue('Synthetic caption 2s');
    expect(await readStored(page, 'oyno.curatorChallenge.v1')).toEqual({});

    // Reopen after a restart: a normal collection + exhibition, with the existing visitor views.
    await page.goto('/profile/my-collections');
    await page.getByText('Synthetic yurt story 5d').first().click();
    await page.getByTestId('museum-entry').click();
    await expect(page.getByTestId('museum-exhibit-2')).toBeVisible();
    await page.getByTestId('museum-preview').click();
    await page.getByTestId('preview-start-exhibition').click();
    await expect(page.getByTestId('museum-slide-caption')).toContainText('Synthetic caption 2s');
    await expectNoExposedKeys(page);
    expectNoPageErrors(errors);
  });
}

test('KG: offline with cached content the draft keeps working; it survives a reload', async ({ page, context, errors }) => {
  await seed(page, { language: 'kg', guest: true });
  await page.goto('/profile/my-collections/challenge');
  await page.getByTestId('challenge-prompt-introduce').click();
  await page.getByTestId('challenge-search').fill('Түн');
  await page.getByTestId('challenge-add-boz-uy-tunduk').click();
  await context.setOffline(true);
  // Offline: the already-loaded articles still resolve; editing and the checklist work.
  await page.getByTestId('challenge-name').fill('Синтетикалык көргөзмө');
  await expect(page.getByTestId('challenge-pick-unavailable-0')).toHaveCount(0);
  await expect(page.getByTestId('challenge-req-name')).toBeVisible();
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByTestId('challenge-pick-0')).toBeVisible();
  await expect(page.getByTestId('challenge-name')).toHaveValue('Синтетикалык көргөзмө');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
