import type { Page } from '@playwright/test';

import { expect, expectNoPageErrors, seed, test } from '../helpers';

/**
 * Web Beta Feedback with a chosen JPEG, through the real sheet, queue and
 * upload: the fake backend records the storage upload (bytes) and the RPC.
 */

// A real 1x1 JPEG (synthetic test image).
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);

async function openSheetWithImage(page: Page, message: string) {
  await page.getByRole('button', { name: /^Send Beta Feedback/ }).first().click();
  await page.getByTestId('feedback-message').fill(message);
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('feedback-choose-image').click();
  await (await chooser).setFiles({ name: 'screen.jpg', mimeType: 'image/jpeg', buffer: JPEG });
  await expect(page.getByTestId('feedback-image-preview')).toBeVisible();
}

const uploads = (log: { requests: { method: string; path: string; bytes?: number }[] }) => log.requests.filter((request) => request.path.startsWith('/storage/v1/object/beta-feedback/screenshots/'));
const reports = (log: { requests: { path: string; body?: unknown }[] }) => log.requests.filter((request) => request.path === '/rest/v1/rpc/submit_beta_feedback_v2').map((request) => request.body as Record<string, unknown>);

test('a chosen JPEG reaches the upload endpoint with the report', async ({ page, backend, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/settings/help');
  await openSheetWithImage(page, 'Synthetic: map froze after zooming');
  await page.getByTestId('feedback-send').click();
  await expect(page.getByText('Thank you!')).toBeVisible();
  await expect(page.getByTestId('feedback-attachment-note')).toHaveCount(0);
  await expect.poll(() => uploads(backend).length).toBe(1);
  expect(uploads(backend)[0].bytes).toBe(JPEG.byteLength);
  const [report] = reports(backend);
  expect(report.p_screenshot_path).toMatch(/^screenshots\/[0-9a-f-]{36}\.jpg$/);
  expect(uploads(backend)[0].path).toBe(`/storage/v1/object/beta-feedback/${report.p_screenshot_path}`);
  expectNoPageErrors(errors);
});

test('server unreachable, then reload: the queued report still goes out WITH its image', async ({ page, backend, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/settings/help');
  // The connection to the backend is down (deterministic - not the app's own offline signal).
  const down = (route: import('@playwright/test').Route) => route.abort('internetdisconnected');
  await page.route('https://oyno-e2e.test/rest/v1/rpc/**', down);
  await page.route('https://oyno-e2e.test/storage/**', down);
  await openSheetWithImage(page, 'Synthetic: offline report with image');
  await page.getByTestId('feedback-send').click();
  await expect(page.getByText('Saved')).toBeVisible();
  // IndexedDB is available here, so nothing warns that the image is page-only.
  await expect(page.getByTestId('feedback-attachment-note')).toHaveCount(0);
  const queue = await page.evaluate(() => localStorage.getItem('oyno.feedback.pending'));
  expect(queue).toContain('oyno-attachment:');
  expect(queue).not.toContain('blob:');
  expect(reports(backend)).toHaveLength(0);

  await page.unroute('https://oyno-e2e.test/rest/v1/rpc/**', down);
  await page.unroute('https://oyno-e2e.test/storage/**', down);
  await page.reload(); // the blob: URL is gone; the app sends queued reports at start
  await expect.poll(() => uploads(backend).length, { timeout: 15_000 }).toBe(1);
  expect(uploads(backend)[0].bytes).toBe(JPEG.byteLength);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('oyno.feedback.pending') ?? '[]').length)).toBe(0);
  expect(reports(backend)[0].p_screenshot_path).toMatch(/^screenshots\//);
  expectNoPageErrors(errors);
});
