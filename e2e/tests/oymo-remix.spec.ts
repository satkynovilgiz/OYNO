import type { Page } from '@playwright/test';

import { FAKE_SUPABASE } from '../fixtures/backend';
import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/**
 * Remix Studio: open a saved design -> Explore variations -> palette,
 * background, symmetry -> compare (picture + list) -> open the variation as
 * an unsaved copy. The saved design is never written, its recipe stays.
 * The saved design's copies are SEPARATE layers (a mirrored pair), so the
 * 4-way variation must merge them instead of mirroring them twice.
 */
const layer = (id: string, x: number) => ({ id, motifId: 'gul', color: '#2F5233', point: { x, y: 100 }, rotation: 0, scale: 1, visible: true });
const ROW = { id: 'remix-src-1', user_id: 'guest', name: 'Mirrored pair 4t', layers: [layer('layer0', 60), layer('layer1', 240)], background_color: '#EADCC0', symmetry_mode: 'none', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z' };
const STEP = { label: 'start', state: { layers: ROW.layers, backgroundColor: '#EADCC0', symmetry: 'none' } };
const RECIPES = { guest: { byCreation: { 'remix-src-1': { recipe: { trimmed: 0, steps: [STEP] }, savedAt: '2026-10-01T10:00:00Z' } }, legacy: {} } };

async function serve(page: Page) {
  const writes: string[] = [];
  await page.route(`${FAKE_SUPABASE}/rest/v1/oymo_creations*`, async (route) => {
    if (route.request().method() !== 'GET') {
      writes.push(route.request().method());
      return route.fulfill({ status: 400, body: '{}' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([ROW]) });
  });
  return writes;
}

for (const width of [320, 412]) {
  test(`saved design -> variations -> compare -> unsaved copy at ${width}px`, async ({ page, errors }) => {
    const writes = await serve(page);
    await page.setViewportSize({ width, height: 860 });
    await seed(page, { language: 'en', guest: true, storage: { 'oyno.oymoRecipes.v2': RECIPES } });
    await page.goto('/culture/oymo/create');
    await page.getByRole('button', { name: ROW.name }).click();
    await expect(page.getByTestId('oymo-replay-saved')).toBeVisible();
    await page.getByTestId('oymo-explore-variations').click();
    await expect(page).toHaveURL(/\/culture\/oymo\/remix$/);

    // The pair is already mirrored in its layers: "None" would delete layers, "Mirror" is how it looks now.
    await expect(page.getByTestId('remix-symmetry-none')).toBeDisabled();
    await expect(page.getByTestId('remix-symmetry-mirror')).toBeDisabled();
    await expect(page.getByTestId('remix-changes')).toHaveText('No changes yet - choose an option below.');
    await expect(page.getByTestId('remix-open')).toBeDisabled();

    await page.getByTestId('remix-symmetry-fourWay').click();
    await expect(page.getByTestId('remix-change-symmetry')).toContainText('4-way symmetry applied - 1 copy layer merged so nothing is doubled');
    await page.getByTestId('remix-palette-earth').click();
    await expect(page.getByTestId('remix-change-palette')).toContainText('Palette “Earth browns”: 2 layers recoloured');
    await page.getByTestId('remix-background-darkGreen').click();
    await expect(page.getByTestId('remix-change-background')).toContainText('Background changed: Cream → Dark green');
    // The list alternative: 2 layers / 2 shown vs 1 layer / 4 shown.
    await expect(page.getByTestId('remix-list')).toContainText('Original2 layers2 motifs shown');
    await expect(page.getByTestId('remix-list')).toContainText('Variation1 layer4 motifs shown');
    await expectNoHorizontalOverflow(page);

    await page.getByTestId('remix-open').click();
    await expect(page).toHaveURL(/\/culture\/oymo\/create$/);
    await expect(page.getByTestId('oymo-handoff-note')).toContainText('unsaved copy of a variation');
    // A new design: not the saved creation (no saved-recipe replay on it; the original Creator below in the stack is hidden).
    await expect(page.getByTestId('oymo-replay-saved').locator('visible=true')).toHaveCount(0);

    // Back twice: the studio, then the original - still the saved design with its recipe.
    await page.getByRole('button', { name: 'Back', exact: true }).locator('visible=true').click();
    await expect(page).toHaveURL(/\/culture\/oymo\/remix$/);
    await page.getByTestId('remix-back').locator('visible=true').click();
    await expect(page).toHaveURL(/\/culture\/oymo\/create$/);
    await expect(page.getByTestId('oymo-replay-saved').locator('visible=true')).toBeVisible();
    expect(writes).toEqual([]);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('oyno.oymoRecipes.v2') ?? '{}'));
    expect(stored).toEqual(RECIPES);
    await expectNoExposedKeys(page);
    expectNoPageErrors(errors);
  });
}

test('RU, offline and accessible; a direct visit has nothing to show', async ({ page, context, errors }) => {
  await serve(page);
  await seed(page, { language: 'ru', guest: true });
  await page.goto('/culture/oymo/create');
  await page.getByRole('button', { name: ROW.name }).click();
  await context.setOffline(true);
  await page.getByTestId('oymo-explore-variations').click();
  await page.getByTestId('remix-symmetry-fourWay').click();
  await expect(page.getByTestId('remix-change-symmetry')).toContainText('Применена симметрия');
  await expectNoExposedKeys(page);
  await expectNoSeriousViolations(page, 'remix studio');
  await context.setOffline(false);
  // A reload / direct link: the in-memory design is gone, so there is nothing to show (and nothing breaks).
  await page.goto('/culture/oymo/remix');
  await expect(page.getByTestId('remix-none')).toContainText('Нет узора для вариантов');
  expectNoPageErrors(errors);
});
