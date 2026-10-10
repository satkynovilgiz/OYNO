import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, readStored, seed, test } from '../helpers';

/**
 * Culture Time Capsule: a design from the Creator -> title, message, an
 * article, a date -> seal -> (the device clock moves past the date) ->
 * "Ready to open" -> open -> reflection. Playwright's clock stands in for
 * the passing days; nothing is scheduled by the app.
 */
const START = new Date('2026-10-10T10:00:00');

for (const width of [320, 412]) {
  test(`create -> seal -> open on the date -> reflect at ${width}px`, async ({ page, errors }) => {
    await page.clock.install({ time: START });
    await page.setViewportSize({ width, height: 860 });
    await seed(page, { language: 'en', guest: true });
    await page.goto('/culture/oymo/create');
    await page.getByRole('button', { name: 'Place at center' }).click();
    await page.getByTestId('oymo-to-capsule').click();
    await expect(page).toHaveURL(/\/profile\/capsules\/new$/);
    await expect(page.getByTestId('capsule-design')).toContainText('A copy of the design as it was');

    await page.getByTestId('capsule-title').fill('For next week');
    await page.getByTestId('capsule-message').fill('Synthetic message to my future self 6t');
    await page.getByTestId('capsule-article-search').fill('Түн');
    await page.getByTestId('capsule-article-add-boz-uy-tunduk').click();
    await page.getByTestId('capsule-quick-week').click();
    await expect(page.getByTestId('capsule-date-value')).toHaveText('October 17, 2026');
    await expect(page.getByTestId('capsule-draft')).toContainText("can't be edited");
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousViolations(page, 'capsule draft');
    await page.getByTestId('capsule-seal').click();

    // Sealed: the message isn't shown; the explanation says it isn't encryption.
    await expect(page.getByTestId('capsule-sealed-until')).toContainText('Sealed until October 17, 2026 - 7 days to go.');
    await expect(page.getByText('Synthetic message to my future self 6t').locator('visible=true')).toHaveCount(0);
    await expect(page.getByTestId('capsule-sealed')).toContainText('It is not encrypted');
    await expect(page.getByTestId('capsule-open')).toHaveCount(0);

    // The day before: still sealed. On the date (local calendar): ready.
    await page.clock.setSystemTime(new Date('2026-10-16T23:59:00'));
    await page.goto('/profile/capsules');
    await expect(page.locator('[data-testid^="capsule-row-"]')).toContainText('Sealed until October 17, 2026');
    await page.clock.setSystemTime(new Date('2026-10-17T00:01:00'));
    await page.reload();
    await expect(page.locator('[data-testid^="capsule-row-"]')).toContainText('Ready to open');
    await page.locator('[data-testid^="capsule-row-"]').click();
    await page.getByTestId('capsule-open').click();

    await expect(page.getByTestId('capsule-message-opened')).toContainText('Synthetic message to my future self 6t');
    await expect(page.getByTestId('capsule-articles-opened')).toContainText('Түндүк');
    await expect(page.getByTestId('capsule-design-opened')).toBeVisible();
    await page.getByTestId('capsule-reflection').fill('Synthetic reflection 2m');
    await page.getByTestId('capsule-save-reflection').click();
    await page.reload();
    await expect(page.getByTestId('capsule-reflection')).toHaveValue('Synthetic reflection 2m');
    await expect(page.getByTestId('capsule-message-opened')).toContainText('Synthetic message to my future self 6t');

    const stored = await readStored<Record<string, { status: string; openedEarly: boolean; design: { layers: unknown[] } }[]>>(page, 'oyno.timeCapsules.v1');
    expect(stored?.guest?.[0]).toMatchObject({ status: 'opened', openedEarly: false });
    expect(stored?.guest?.[0].design.layers).toHaveLength(1);
    await expectNoExposedKeys(page);
    expectNoPageErrors(errors);
  });
}

test('early opening needs confirmation; delete needs confirmation (KG)', async ({ page, errors }) => {
  await page.clock.install({ time: START });
  await seed(page, { language: 'kg', guest: true });
  await page.goto('/profile/capsules');
  await page.getByTestId('capsule-new').click();
  await page.getByTestId('capsule-title').fill('Synthetic title 1q');
  await page.getByTestId('capsule-message').fill('Synthetic message 8u');
  await page.getByTestId('capsule-quick-year').click();
  await page.getByTestId('capsule-seal').click();
  await page.getByTestId('capsule-open-early').click();
  await expect(page.getByTestId('capsule-early-confirm')).toBeVisible();
  await page.getByTestId('capsule-early-no').click();
  await expect(page.getByTestId('capsule-sealed')).toBeVisible();
  await page.getByTestId('capsule-open-early').click();
  await page.getByTestId('capsule-early-yes').click();
  await expect(page.getByTestId('capsule-message-opened')).toContainText('Synthetic message 8u');
  await page.getByTestId('capsule-delete').click();
  await page.getByTestId('capsule-delete-yes').click();
  await expect(page).toHaveURL(/\/profile\/capsules$/);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
