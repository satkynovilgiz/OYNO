import type { Page } from '@playwright/test';

import { fingerprint, type Recipe } from '../../src/features/culture/oymo/recipe/recipeModel';
import { FAKE_SUPABASE } from '../fixtures/backend';
import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/**
 * Pattern Recipe. The e2e backend has no sign-in, and only signed-in
 * accounts can save creations, so the SAVE step (with the recipe toggle)
 * is covered by recipe.test.ts through the real Creator. Here:
 *   edit -> replay this design -> step / scrub -> copy a stage, and
 *   reopen a saved creation whose recipe is on this device -> replay -> copy a stage.
 */

const layer = (id: string, x: number, motifId: string) => ({ id, motifId, color: '#2F5D3A', point: { x, y: 150 }, rotation: 0, scale: 1, visible: true });
const FINAL = { layers: [layer('layer-0', 90, 'gul'), layer('layer-1', 150, 'muyuz')], backgroundColor: '#FBF3E3', symmetry: 'mirror' as const };
const RECIPE: Recipe = {
  trimmed: 0,
  steps: [
    { label: 'start', state: { layers: [], backgroundColor: '#EADCC0', symmetry: 'fourWay' } },
    { label: 'place', motifId: 'gul', state: { layers: [FINAL.layers[0]], backgroundColor: '#EADCC0', symmetry: 'fourWay' } },
    { label: 'symmetry', state: { layers: [FINAL.layers[0]], backgroundColor: '#EADCC0', symmetry: 'mirror' } },
    { label: 'place', motifId: 'muyuz', state: { layers: FINAL.layers, backgroundColor: '#EADCC0', symmetry: 'mirror' } },
    { label: 'background', state: FINAL },
  ],
};
const SAVED_ROW = { id: 'saved-recipe-1', user_id: 'guest', name: 'Synthetic recipe pattern 3q', layers: FINAL.layers, background_color: FINAL.backgroundColor, symmetry_mode: FINAL.symmetry, created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z' };
const OLD_ROW = { ...SAVED_ROW, id: 'older-1', name: 'Older pattern 7k', layers: [layer('layer-0', 60, 'bulak')] };

async function serveCreations(page: Page, rows: unknown[]) {
  const writes: string[] = [];
  await page.route(`${FAKE_SUPABASE}/rest/v1/oymo_creations*`, async (route) => {
    if (route.request().method() !== 'GET') {
      writes.push(route.request().method());
      return route.fulfill({ status: 400, body: '{}' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
  });
  return writes;
}

test('edit -> replay this design -> step through -> open a stage as a new unsaved design', async ({ page, errors }) => {
  await serveCreations(page, []);
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/oymo/create');
  await page.getByRole('button', { name: 'Place at center' }).click();
  await page.getByRole('button', { name: 'Symmetry', exact: true }).click();
  await page.getByRole('button', { name: 'Mirror', exact: true }).click();
  await page.getByRole('button', { name: 'Place at center' }).click();
  await page.getByTestId('oymo-replay-session').click();
  await expect(page).toHaveURL(/\/culture\/oymo\/recipe\?source=session/);

  // It plays by itself to the final design.
  await expect(page.getByTestId('recipe-final')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('recipe-step')).toHaveText('Step 4 of 4 · Placed Müyüz (horn)');
  await page.getByTestId('recipe-previous').click();
  await expect(page.getByTestId('recipe-step')).toHaveText('Step 3 of 4 · Changed the symmetry');
  await page.getByTestId('recipe-chip-1').click();
  await expect(page.getByTestId('recipe-step')).toHaveText('Step 2 of 4 · Placed Müyüz (horn)');
  await page.getByTestId('recipe-open-stage').click();
  await expect(page).toHaveURL(/\/culture\/oymo\/create$/);
  await expect(page.getByTestId('oymo-handoff-note')).toContainText('A copy of one recipe stage');
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('reopen a saved creation with its recipe -> replay -> copy a stage; an older creation has none', async ({ page, errors }) => {
  const writes = await serveCreations(page, [SAVED_ROW, OLD_ROW]);
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.oymoRecipes.v1': { guest: { [fingerprint(FINAL)]: { recipe: RECIPE, savedAt: '2026-10-01T10:00:00Z' } } } } });
  await page.goto('/culture/oymo/create');
  await page.getByRole('button', { name: OLD_ROW.name }).click();
  await expect(page.getByTestId('oymo-replay-saved')).toHaveCount(0);
  await page.getByRole('button', { name: SAVED_ROW.name }).click();
  await page.getByTestId('oymo-replay-saved').click();
  await expect(page).toHaveURL(/\/culture\/oymo\/recipe\?creation=saved-recipe-1/);
  await expect(page.getByTestId('recipe-final')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('recipe-step')).toHaveText('Step 5 of 5 · Changed the background');
  await page.getByTestId('recipe-chip-2').click();
  await expect(page.getByTestId('recipe-step')).toHaveText('Step 3 of 5 · Changed the symmetry');
  await page.getByTestId('recipe-open-stage').click();
  await expect(page.getByTestId('oymo-handoff-note')).toBeVisible();
  // The saved creation was never written to.
  expect(writes).toEqual([]);
  // The v1 (content-keyed) recipe was adopted by its only matching creation, by id.
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('oyno.oymoRecipes.v2') ?? '{}'));
  expect(Object.keys(stored.guest.byCreation)).toEqual(['saved-recipe-1']);
  // An older creation's player explains there is no recipe.
  await page.goto('/culture/oymo/recipe?creation=older-1');
  await expect(page.getByTestId('recipe-none')).toContainText('has no recipe');
  expectNoPageErrors(errors);
});

test('Reduce Motion: the recipe does not play by itself; KG/RU; accessible', async ({ page, errors }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await serveCreations(page, [SAVED_ROW]);
  await seed(page, { language: 'ru', guest: true, storage: { 'oyno.oymoRecipes.v1': { guest: { [fingerprint(FINAL)]: { recipe: RECIPE, savedAt: '' } } } } });
  await page.goto('/culture/oymo/recipe?creation=saved-recipe-1');
  await expect(page.getByTestId('recipe-step')).toContainText('1');
  await page.waitForTimeout(2000);
  await expect(page.getByTestId('recipe-step')).toContainText('Шаг 1 из 5');
  await page.getByTestId('recipe-next').click();
  await expect(page.getByTestId('recipe-step')).toContainText('Шаг 2 из 5');
  await expectNoExposedKeys(page);
  await expectNoSeriousViolations(page, 'recipe player');
  expectNoPageErrors(errors);
});

test('two identical saved creations: only the one saved with a recipe offers it', async ({ page, errors }) => {
  const twin = { ...SAVED_ROW, id: 'twin-2', name: 'Synthetic twin 5r' };
  await serveCreations(page, [SAVED_ROW, twin]);
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.oymoRecipes.v2': { guest: { byCreation: { 'saved-recipe-1': { recipe: RECIPE, savedAt: '' } }, legacy: {} } } } });
  await page.goto('/culture/oymo/create');
  await page.getByRole('button', { name: twin.name }).click();
  await expect(page.getByTestId('oymo-replay-saved')).toHaveCount(0);
  await page.getByRole('button', { name: SAVED_ROW.name }).click();
  await expect(page.getByTestId('oymo-replay-saved')).toBeVisible();
  await page.goto('/culture/oymo/recipe?creation=twin-2');
  await expect(page.getByTestId('recipe-none')).toContainText('has no recipe');
  // A direct visit to the session route with no session of this account's own shows nothing.
  await page.goto('/culture/oymo/recipe?source=session');
  await expect(page.getByTestId('recipe-none')).toContainText('nothing to replay');
  expectNoPageErrors(errors);
});
