import { FAKE_SUPABASE } from '../fixtures/backend';
import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Stencil Studio: saved design -> Make a stencil -> outline preview + settings; only ticked labels; the design is never written. */
const layer = (id: string, x: number, rotation = 0) => ({ id, motifId: 'gul', color: '#C0392B', point: { x, y: 100 }, rotation, scale: 1, visible: true });
const ROW = { id: 'stencil-src-1', user_id: 'guest', name: 'Two flowers', layers: [layer('layer0', 60), layer('layer1', 200, 30)], background_color: '#EADCC0', symmetry_mode: 'mirror', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z' };

for (const width of [320, 412]) {
  test(`saved design -> outline page preview at ${width}px`, async ({ page, errors }) => {
    const writes: string[] = [];
    await page.route(`${FAKE_SUPABASE}/rest/v1/oymo_creations*`, async (route) => {
      if (route.request().method() !== 'GET') {
        writes.push(route.request().method());
        return route.fulfill({ status: 400, body: '{}' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([ROW]) });
    });
    await page.setViewportSize({ width, height: 860 });
    await seed(page, { language: 'en', guest: true });
    await page.goto('/culture/oymo/create');
    await page.getByRole('button', { name: ROW.name }).click();
    await page.getByTestId('oymo-make-stencil').click();
    await expect(page).toHaveURL(/\/culture\/oymo\/stencil$/);

    await expect(page.getByTestId('stencil-not-cut-ready')).toContainText('not a cut-ready stencil');
    const preview = page.getByTestId('stencil-preview');
    // 2 layers x 2 mirrored copies x 6 circles (the gul motif's own geometry).
    await expect(preview.locator('circle')).toHaveCount(24);
    await expect(preview.locator('text')).toHaveCount(0); // no labels until ticked
    await expect(preview).toHaveAttribute('aria-label', /A4 portrait outline page with 4 motif copies/);
    await expect(page.getByTestId('stencil-output-facts')).toContainText('185 mm square');

    await page.getByTestId('stencil-orientation-landscape').click();
    await expect(page.getByTestId('stencil-orientation-landscape')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('stencil-output-facts')).toContainText('162 mm square');
    await page.getByTestId('stencil-thickness-thick').click();
    await page.getByTestId('stencil-guides').click();
    await expect(preview.locator('line')).toHaveCount(6);
    await page.getByTestId('stencil-label-name').click();
    await expect(preview.locator('text')).toHaveText(['Two flowers']);
    await expect(page.getByTestId('stencil-limit-smallDetail')).toHaveCount(0);

    // Web: the PDF flow isn't available - said plainly, the preview still works.
    await expect(page.getByTestId('stencil-export-unsupported')).toContainText('PDF export needs the OYNO app');
    await expect(page.getByTestId('stencil-export')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousViolations(page, 'stencil studio');
    await expectNoExposedKeys(page);

    await page.goBack();
    await expect(page).toHaveURL(/\/culture\/oymo\/create/);
    expect(writes).toEqual([]); // the saved design was never written
    expectNoPageErrors(errors);
  });
}

test('opened directly, without a design: says how to start', async ({ page, errors }) => {
  await seed(page, { language: 'ru', guest: true });
  await page.goto('/culture/oymo/stencil');
  await expect(page.getByTestId('stencil-no-design')).toContainText('Сделать трафарет');
  expectNoPageErrors(errors);
});
