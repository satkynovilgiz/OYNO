import type { Page } from '@playwright/test';

import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, nextOnboardingSlide, readStored, seed, test } from '../helpers';

/** First visit: language -> onboarding (guest) -> age group -> Home, where the guide is offered. */
async function firstVisit(page: Page) {
  await seed(page, { language: 'kg' });
  await page.goto('/');
  await page.getByTestId('language-en').click();
  await page.getByTestId('language-continue').click();
  await nextOnboardingSlide(page, 2);
  await nextOnboardingSlide(page, 3);
  await page.getByTestId('onboarding-guest').click();
  await page.getByTestId('age-18+').click();
  await page.getByTestId('age-continue').click();
  await expect(page).toHaveURL(/\/home$/);
}
const visible = (page: Page, id: string) => page.locator(`[data-testid="${id}"]`).locator('visible=true');

test('first visit -> article -> guided design -> sign-in handoff keeps it -> choose not to save -> shelf', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await firstVisit(page);
  await expect(page.getByTestId('first-use-card-offer')).toBeVisible();
  await page.getByTestId('first-use-card-start').click();
  await expect(page).toHaveURL(/\/start$/);

  // 1. One article: open it, come back.
  await expect(page.getByTestId('first-use-step-article')).toContainText('Now');
  await page.getByTestId('first-use-open-article').click();
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-overview/);
  await page.goBack();
  await expect(visible(page, 'first-use-step-article')).toContainText('Done');

  // 2. Guided design.
  await expect(visible(page, 'first-use-create-done')).toBeDisabled();
  await visible(page, 'first-use-place').click();
  await visible(page, 'first-use-place').click();
  await visible(page, 'first-use-undo').click();
  await expect(visible(page, 'first-use-count')).toContainText('1 of 12 motifs');
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousViolations(page, 'first-use create');
  await visible(page, 'first-use-create-done').click();

  // 3. Save: a guest is told why it isn't saved; sign-in is asked for only here, and the design waits.
  await expect(visible(page, 'first-use-guest-note')).toContainText("as a guest this one isn't saved");
  await visible(page, 'first-use-sign-in').click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goBack();
  await expect(visible(page, 'first-use-step-save')).toContainText('Now');
  await expect(page.getByTestId('first-use-design-gone')).toHaveCount(0);
  await expect(visible(page, 'first-use-sign-in')).toBeEnabled();
  await visible(page, 'first-use-dont-save').click();

  // 4. The shelf - honest that nothing was saved.
  await expect(visible(page, 'first-use-step-find')).toContainText("This design wasn't saved");
  await visible(page, 'first-use-open-shelf').click();
  await expect(page).toHaveURL(/\/profile\/shelf/);
  await page.goBack();
  await expect(visible(page, 'first-use-finished')).toContainText('nothing was kept');
  await expect(visible(page, 'first-use-finished')).not.toContainText(/score|level|master/i);
  const stored = await readStored<Record<string, { status: string; saveChoice: string }>>(page, 'oyno.firstUse.v1');
  expect(stored?.guest).toMatchObject({ status: 'finished', saveChoice: 'not_saved' });

  // Home no longer offers it; Help replays it.
  await page.goto('/home');
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.getByTestId('first-use-card-offer')).toHaveCount(0);
  await page.goto('/settings/help');
  await page.getByTestId('help-first-use').click();
  await visible(page, 'first-use-replay').click();
  await expect(visible(page, 'first-use-step-article')).toContainText('Now');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('skip from Home; resume an unfinished guide after a reload', async ({ page, errors }) => {
  await firstVisit(page);
  await page.getByTestId('first-use-card-skip').click();
  await expect(page.getByTestId('first-use-card-offer')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.getByTestId('first-use-card-offer')).toHaveCount(0);

  // Started from Help, left after step 1, picked up again from Home.
  await page.goto('/start');
  await page.getByTestId('first-use-start').click();
  await page.getByTestId('first-use-open-article').click();
  await expect(page).toHaveURL(/\/culture\/item\//);
  await page.goto('/home');
  await expect(page.getByTestId('first-use-card-continue')).toBeVisible();
  await page.getByTestId('first-use-card-start').click();
  await expect(page.getByTestId('first-use-step-create')).toContainText('Now');
  expectNoPageErrors(errors);
});

test('existing users are not offered the guide unprompted', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/home');
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.getByTestId('first-use-card-offer')).toHaveCount(0);
  expectNoPageErrors(errors);
});
