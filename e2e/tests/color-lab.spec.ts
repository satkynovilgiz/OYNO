import { FAKE_SUPABASE } from '../fixtures/backend';
import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, readStored, seed, test } from '../helpers';

/** Color Lab: saved design -> inspect -> grayscale / approximation -> suggestion preview -> unsaved Creator copy. Nothing is written. */
const layer = (id: string, color: string, x: number) => ({ id, motifId: 'gul', color, point: { x, y: 100 }, rotation: 0, scale: 1, visible: true });
const ROW = { id: 'color-src-1', user_id: 'guest', name: 'Close browns', layers: [layer('layer0', '#6B4F2A', 60), layer('layer1', '#7A5A30', 150)], background_color: '#5E4426', symmetry_mode: 'none', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z' };
const RECIPES = { guest: { byCreation: { 'color-src-1': { recipe: { trimmed: 0, steps: [{ label: 'start', state: { layers: ROW.layers, backgroundColor: '#5E4426', symmetry: 'none' } }] }, savedAt: '2026-10-01T10:00:00Z' } }, legacy: {} } };

for (const width of [320, 412]) {
  test(`inspect -> preview -> Creator copy at ${width}px`, async ({ page, errors }) => {
    const writes: string[] = [];
    await page.route(`${FAKE_SUPABASE}/rest/v1/oymo_creations*`, async (route) => {
      if (route.request().method() !== 'GET') {
        writes.push(route.request().method());
        return route.fulfill({ status: 400, body: '{}' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([ROW]) });
    });
    await page.setViewportSize({ width, height: 900 });
    await seed(page, { language: 'en', guest: true, storage: { 'oyno.oymoRecipes.v2': RECIPES } });
    await page.goto('/culture/oymo/create');
    await page.getByRole('button', { name: ROW.name }).click();
    await page.getByTestId('oymo-color-lab').click();
    await expect(page).toHaveURL(/\/culture\/oymo\/colors$/);

    await expect(page.getByTestId('color-lab-disclaimer')).toContainText("don't certify");
    await expect(page.getByTestId('color-lab-color-0')).toContainText('#6B4F2A');
    await expect(page.getByTestId('color-lab-color-0')).toContainText(/Brown|brown/);
    await expect(page.getByTestId('color-lab-background')).toContainText('#5E4426');
    await expect(page.getByTestId('color-lab-hard-pair').first()).toContainText(':1');
    await page.getByTestId('color-lab-view-grayscale').click();
    await expect(page.getByTestId('color-lab-view-grayscale')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('color-lab-view-deuteranopia').click();
    await expect(page.getByTestId('color-lab')).toContainText('approximate simulation');
    await page.getByTestId('color-lab-view-normal').click();

    // Nothing changes until the user chooses.
    await expect(page.getByTestId('color-lab-open-copy')).toBeDisabled();
    const before = await page.getByTestId('color-lab-alt-weakest').textContent();
    await page.getByTestId('color-lab-preview-suggestion').click();
    await expect(page.getByTestId('color-lab-alt-weakest')).not.toHaveText(before!);
    // A manual change too.
    await page.getByTestId('color-lab-replace-1').click();
    await page.locator('[data-testid^="color-lab-pick-1-"]').first().click();
    await expect(page.getByTestId('color-lab-color-1')).toContainText('→');
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousViolations(page, 'color lab');
    await expectNoExposedKeys(page);

    await page.getByTestId('color-lab-open-copy').click();
    await expect(page).toHaveURL(/\/culture\/oymo\/create/);
    await expect(page.locator('[data-testid="oymo-handoff-note"]').locator('visible=true')).toContainText('Opened from Color Lab');
    expect(writes).toEqual([]); // the saved design is never written
    expect(await readStored(page, 'oyno.oymoRecipes.v2')).toEqual(RECIPES); // its recipe is untouched
    expectNoPageErrors(errors);
  });
}

test('opened directly: says how to start (KG)', async ({ page, errors }) => {
  await seed(page, { language: 'kg', guest: true });
  await page.goto('/culture/oymo/colors');
  await expect(page.getByTestId('color-lab-no-design')).toContainText('Түс лабораториясы');
  expectNoPageErrors(errors);
});
