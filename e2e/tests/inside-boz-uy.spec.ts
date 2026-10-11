import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, readStored, seed, test } from '../helpers';

/**
 * "Inside a boz uy" (a Learning Path journey): overview -> open the sourced
 * connection -> Back to Learning Path -> it is only "In progress" (opened) ->
 * Mark step complete -> skip the optional reflection -> Continue opens the
 * next unfinished step -> back -> reload: progress kept.
 */
test('overview -> activity -> return -> continue', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await seed(page, { language: 'en', guest: true });
  await page.goto('/learn/inside-boz-uy');
  await expect(page.getByText('Inside a boz uy').first()).toBeVisible();
  await expect(page.getByTestId('path-evidence-connection')).toContainText('Кереге (дубал каркасы), уук (чатыр таякчалары), түндүк');
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousViolations(page, 'journey overview');

  // Open the connection step, then come back with the path pill.
  await page.getByTestId('path-step-connection').getByRole('button').first().click();
  await expect(page).toHaveURL(/\/culture\/connections\/tunduk-part-of-karkas/);
  await page.getByTestId('path-return').click();
  await expect(page).toHaveURL(/\/learn\/inside-boz-uy/);
  // Opened is not finished.
  await expect(page.getByTestId('path-step-connection')).toContainText('In progress');
  await expect(page.getByTestId('path-progress')).toContainText('0');

  await page.getByTestId('path-finish-connection').click();
  await expect(page.getByTestId('path-step-connection')).toContainText('Completed');
  await page.getByTestId('path-skip-reflection').click();
  await expect(page.getByTestId('path-step-reflection')).toContainText('Skipped');

  // Continue: the first unfinished step (the article).
  await page.getByTestId('path-start').click();
  await expect(page).toHaveURL(/\/culture\/item\/boz-uy-overview/);
  await page.getByTestId('path-return').click();
  await page.reload();
  await expect(page.getByTestId('path-step-connection')).toContainText('Completed');
  await expect(page.getByTestId('path-step-reflection')).toContainText('Skipped');
  await expect(page.getByTestId('path-step-discover')).toContainText('In progress');
  const manual = await readStored<Record<string, Record<string, Record<string, string>>>>(page, 'oyno.learningPaths.v1');
  expect(Object.keys(manual?.guest?.['inside-boz-uy'] ?? {})).toEqual(['connection']);

  // Restart needs a confirmation.
  await page.getByTestId('path-restart').click();
  await page.getByTestId('path-restart-yes').click();
  await expect(page.getByTestId('path-step-connection')).toContainText('Not started');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
