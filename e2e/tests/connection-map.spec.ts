import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Connection Map: article -> map -> expand -> evidence -> source -> back to the same map state. */
const visible = (page: import('@playwright/test').Page, id: string) => page.locator(`[data-testid="${id}"]`).locator('visible=true');

test('expand -> evidence -> source -> return', async ({ page, errors }) => {
  await page.setViewportSize({ width: 412, height: 900 });
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/item/boz-uy-karkas');
  await page.getByTestId('connection-map-entry').click();
  await expect(page).toHaveURL(/\/culture\/connections\/map\?start=boz-uy-karkas/);
  await expect(visible(page, 'connection-map')).toContainText('Arrows point the way');

  const edges = page.locator('[data-testid^="connection-map-edge-"]').locator('visible=true');
  const before = await edges.count();
  expect(before).toBeGreaterThan(0);
  const expandButtons = page.locator('[data-testid^="connection-map-expand-"]').locator('visible=true');
  if ((await expandButtons.count()) > 0) {
    await expandButtons.first().click();
    await expect.poll(() => edges.count()).toBeGreaterThanOrEqual(before);
  }
  const edgeCount = await edges.count();

  await page.getByTestId('connection-map-zoom').click();
  await edges.first().click();
  const panel = visible(page, 'connection-map-evidence');
  await expect(panel).toContainText('“');
  const panelText = await panel.textContent();
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousViolations(page, 'connection map');
  await expectNoExposedKeys(page);

  await visible(page, 'connection-map-open-source').click();
  await expect(page).toHaveURL(/\/culture\/item\/[a-z0-9-]+\?section=/);
  await page.goBack();
  await expect(visible(page, 'connection-map-evidence')).toHaveText(panelText!); // same selection
  await expect(page.locator('[data-testid^="connection-map-edge-"]').locator('visible=true')).toHaveCount(edgeCount); // same expansion
  await expect(visible(page, 'connection-map-zoom')).toHaveText('Zoom out'); // same viewport zoom
  expectNoPageErrors(errors);
});

test('the list and the map count the same connections (RU)', async ({ page, errors }) => {
  await seed(page, { language: 'ru', guest: true });
  await page.goto('/culture/connections/map?start=boz-uy-karkas');
  const text = (await page.getByTestId('connection-map').textContent()) ?? '';
  const m = /связей: (\d+)/.exec(text);
  expect(m).not.toBeNull();
  await expect(page.locator('[data-testid^="connection-map-edge-"]')).toHaveCount(Number(m![1]));
  await expect(page.getByTestId('connection-map')).toContainText('ваши заметки никогда не входят в карту');
  expectNoPageErrors(errors);
});
