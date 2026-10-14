import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, LANGUAGES, seed, test } from '../helpers';

/** The screens migrated to the shared UI conventions (docs/UI_CONVENTIONS.md): readable, no overflow, no serious axe issues, in every language. */
const SCREENS = [
  { name: 'home', route: '/home', ready: 'home-primary' },
  { name: 'article', route: '/culture/item/boz-uy-tunduk', ready: null },
  { name: 'creator', route: '/culture/oymo/create', ready: null },
  { name: 'profile', route: '/profile', ready: null },
] as const;

for (const language of LANGUAGES) {
  test(`migrated screens in ${language.toUpperCase()} (360 px)`, async ({ page, errors }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await seed(page, { language, guest: true });
    for (const screen of SCREENS) {
      await page.goto(screen.route);
      if (screen.ready) await expect(page.getByTestId(screen.ready)).toBeVisible();
      else await page.waitForLoadState('networkidle');
      await page.waitForTimeout(400);
      await expectNoHorizontalOverflow(page);
      await expectNoExposedKeys(page);
      await expectNoSeriousViolations(page, `${screen.name} ${language}`);
      await page.screenshot({ path: `e2e/.results/ui-${screen.name}-${language}.png` });
    }
    expectNoPageErrors(errors);
  });
}
