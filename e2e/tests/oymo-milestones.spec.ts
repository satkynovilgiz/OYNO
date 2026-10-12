import { FAKE_SUPABASE } from '../fixtures/backend';
import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, readStored, seed, test } from '../helpers';

/** Revision Gallery: saved design -> milestone -> edit -> milestone -> compare -> open the earlier one as a copy. Nothing saved is overwritten. */
const layer = (id: string, x: number) => ({ id, motifId: 'gul', color: '#2F5233', point: { x, y: 100 }, rotation: 0, scale: 1, visible: true });
const ROW = { id: 'ms-src-1', user_id: 'guest', name: 'Two flowers', layers: [layer('layer0', 60), layer('layer1', 200)], background_color: '#EADCC0', symmetry_mode: 'none', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z' };
const visible = (page: import('@playwright/test').Page, id: string) => page.locator(`[data-testid="${id}"]`).locator('visible=true');

test('milestone -> edit -> compare -> restore copy', async ({ page, errors }) => {
  const writes: string[] = [];
  await page.route(`${FAKE_SUPABASE}/rest/v1/oymo_creations*`, async (route) => {
    if (route.request().method() !== 'GET') {
      writes.push(route.request().method());
      return route.fulfill({ status: 400, body: '{}' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([ROW]) });
  });
  await page.setViewportSize({ width: 412, height: 900 });
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/oymo/create');
  await page.getByRole('button', { name: ROW.name }).click();

  await page.getByTestId('milestone-open').click();
  await page.getByTestId('milestone-label').fill('Start');
  await page.getByTestId('milestone-save').click();
  await expect(page.getByTestId('milestone-result-saved')).toBeVisible();

  // Edit the design (it stays tied to its saved creation), then a second milestone.
  await page.getByRole('button', { name: 'Place at center' }).click();
  await page.getByTestId('milestone-open').click();
  await page.getByTestId('milestone-label').fill('With centre');
  await page.getByTestId('milestone-save').click();
  await expect(page.getByTestId('milestone-gallery')).toHaveText('Milestones (2)');
  const stored = await readStored<Record<string, Record<string, { label: string; snapshot: { layers: unknown[] } }[]>>>(page, 'oyno.oymoMilestones.v1');
  expect(stored!.guest['ms-src-1'].map((m) => [m.label, m.snapshot.layers.length])).toEqual([['Start', 2], ['With centre', 3]]);

  await page.getByTestId('milestone-gallery').click();
  await expect(page).toHaveURL(/\/culture\/oymo\/milestones\/ms-src-1$/);
  await expect(visible(page, 'milestone-gallery-screen')).toContainText('only on this device');
  await visible(page, 'milestone-select-0').click();
  await visible(page, 'milestone-select-1').click();
  await expect(visible(page, 'milestone-compare')).toContainText('From Start to With centre');
  const diffs = page.locator('[data-testid="milestone-diff"]').locator('visible=true');
  await expect(diffs).toHaveCount(1);
  await expect(diffs).toContainText('added');
  await expect(visible(page, 'milestone-compare')).toContainText('not whether one is better');
  await expectNoSeriousViolations(page, 'milestone gallery');

  // Open the earlier milestone as a copy: the Creator gets a new unsaved design.
  await visible(page, 'milestone-open-copy-0').click();
  await expect(page).toHaveURL(/\/culture\/oymo\/create/);
  await expect(visible(page, 'oymo-handoff-note')).toContainText('Opened from a milestone');
  expect(writes).toEqual([]);
  const after = await readStored<Record<string, Record<string, { snapshot: { layers: unknown[] } }[]>>>(page, 'oyno.oymoMilestones.v1');
  expect(after!.guest['ms-src-1'][0].snapshot.layers).toHaveLength(2); // unchanged

  // Confirmed delete.
  await page.goto('/culture/oymo/milestones/ms-src-1');
  await page.getByTestId('milestone-delete-1').click();
  await page.getByTestId('milestone-delete-yes-1').click();
  await expect(page.locator('[data-testid^="milestone-select-"]')).toHaveCount(1);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('a deleted parent keeps its milestones until they are deleted (RU)', async ({ page, errors }) => {
  const milestones = { guest: { 'gone-1': [{ id: 'm1', label: 'Old', createdAt: '2026-10-01T00:00:00Z', snapshot: { layers: [layer('layer0', 60)], backgroundColor: '#EADCC0', symmetry: 'none' } }] }, 'user-x': { 'other-1': [{ id: 'm9', label: 'Not mine', createdAt: '2026-10-01T00:00:00Z', snapshot: { layers: [], backgroundColor: '#FFFFFF', symmetry: 'none' } }] } };
  await seed(page, { language: 'ru', guest: true, storage: { 'oyno.oymoMilestones.v1': milestones } });
  await page.goto('/culture/oymo/milestones');
  await expect(page.locator('[data-testid^="milestone-design-"]')).toHaveCount(1); // only this owner's
  await page.getByTestId('milestone-design-gone-1').click();
  await expect(page.getByTestId('milestone-parent-deleted')).toContainText('удалён');
  await page.getByTestId('milestone-delete-all').click();
  await page.getByTestId('milestone-delete-all-yes').click();
  await expect(page).toHaveURL(/\/culture\/oymo\/milestones$/);
  expectNoPageErrors(errors);
});
