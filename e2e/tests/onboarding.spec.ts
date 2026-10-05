import type { Page } from '@playwright/test';

import { expect, expectNextAvailable, expectNoPageErrors, nextOnboardingSlide, readStored, seed, test } from '../helpers';

/**
 * Onboarding pager: the slide shown, the progress label, Next/Start and the
 * guest link always agree - for one tap at a time, rapid taps, swipes
 * (trackpad / touch scroll on web) and the keyboard.
 */
const progress = (page: Page) => page.getByRole('progressbar');
/** A horizontal trackpad / wheel swipe over the slides (scroll snapping settles it on a page). */
async function swipe(page: Page, deltaX: number) {
  const box = (await page.getByTestId('onboarding-pager').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
  await page.mouse.wheel(deltaX, 0);
}

test.beforeEach(async ({ page }) => {
  await seed(page, { language: 'en', storage: { 'oyno.languageChosen': 'true' } });
  await page.goto('/onboarding');
  await expect(progress(page)).toHaveAttribute('aria-label', '1 / 3');
});

test('one tap per slide; the last slide offers guest access', async ({ page, errors }) => {
  await nextOnboardingSlide(page, 2);
  await expect(page.getByTestId('onboarding-guest')).toHaveCount(0);
  await nextOnboardingSlide(page, 3);
  await expect(page.getByTestId('onboarding-next')).toHaveAccessibleName('Get Started');
  await page.getByTestId('onboarding-guest').click();
  await expect(page).toHaveURL(/\/age-group$/);
  expect(await readStored(page, 'oyno.auth.guestMode')).toBe(true);
  expectNoPageErrors(errors);
});

/**
 * A burst of taps 100 ms apart, timed inside the page (Playwright's own
 * per-click overhead varies with machine load). Synthetic clicks ignore
 * aria-disabled, like a fast finger landing on the button again.
 */
const tapBurst = (page: Page, taps = 3) =>
  page.getByTestId('onboarding-next').evaluate(async (element, count) => {
    for (let tap = 0; tap < count; tap += 1) {
      (element as HTMLElement).click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }, taps);

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`a burst of taps moves exactly one slide and never leaves from the second-last slide (motion: ${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.reload();
    await expect(progress(page)).toHaveAttribute('aria-label', '1 / 3');
    const next = page.getByTestId('onboarding-next');

    await tapBurst(page);
    await expectNextAvailable(page);
    await expect(progress(page), 'a burst of taps must move exactly one slide').toHaveAttribute('aria-label', '2 / 3');

    await tapBurst(page);
    await expectNextAvailable(page);
    await expect(progress(page)).toHaveAttribute('aria-label', '3 / 3');
    // Still here, with the guest choice - the extra taps did not become "Get Started".
    await expect(page, 'extra taps must not finish onboarding').toHaveURL(/\/onboarding$/);
    await expect(page.getByTestId('onboarding-guest')).toBeVisible();
  });
}

test('a swipe updates the slide, Start and guest link (and back again)', async ({ page }) => {
  await swipe(page, 2_000);
  await expect(progress(page)).toHaveAttribute('aria-label', '3 / 3');
  await expect(page.getByTestId('onboarding-next')).toHaveAccessibleName('Get Started');
  await expect(page.getByTestId('onboarding-guest')).toBeVisible();

  await swipe(page, -250);
  await expect(progress(page)).toHaveAttribute('aria-label', '2 / 3');
  await expect(page.getByTestId('onboarding-next')).toHaveAccessibleName('Next');
  await expect(page.getByTestId('onboarding-guest')).toHaveCount(0);
  await nextOnboardingSlide(page, 3);
});

test('keyboard: Enter moves one slide at a time, Tab reaches guest access', async ({ page }) => {
  const next = page.getByTestId('onboarding-next');
  await next.focus();
  await page.keyboard.press('Enter');
  // While the slide moves, Next says it is busy - and keeps keyboard focus.
  await expect(next).toHaveAttribute('aria-busy', 'true');
  await expect(next).toBeFocused();
  await expect(progress(page)).toHaveAttribute('aria-label', '2 / 3');
  await expectNextAvailable(page);
  await expect(next).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(progress(page)).toHaveAttribute('aria-label', '3 / 3');
  await expectNextAvailable(page);
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('onboarding-guest')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/age-group$/);
});

test('reduced motion: Next still moves one slide (without the animated scroll)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(progress(page)).toHaveAttribute('aria-label', '1 / 3');
  await nextOnboardingSlide(page, 2);
  await nextOnboardingSlide(page, 3);
  await expect(page.getByTestId('onboarding-guest')).toBeVisible();
});
