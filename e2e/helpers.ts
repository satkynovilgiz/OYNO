import AxeBuilder from '@axe-core/playwright';
import { expect, test as base, type Page } from '@playwright/test';

import en from '../src/i18n/locales/en.json';
import kg from '../src/i18n/locales/kg.json';
import ru from '../src/i18n/locales/ru.json';

import { installBackend, installNetworkGuard, type BackendLog, type UnexpectedRequest } from './fixtures/backend';

export type Language = 'kg' | 'ru' | 'en';
export const LANGUAGES: Language[] = ['kg', 'ru', 'en'];

/** Every i18n key with a dot - if one shows up as text, a translation is missing. */
const KEYS = new Set<string>();
const flatten = (node: unknown, prefix = '') => {
  if (node && typeof node === 'object') for (const [key, value] of Object.entries(node)) flatten(value, prefix ? `${prefix}.${key}` : key);
  else if (prefix.includes('.')) KEYS.add(prefix.replace(/_(one|few|many|other)$/, ''));
};
[kg, ru, en].forEach((locale) => flatten(locale));

type Fixtures = { backend: BackendLog; errors: string[] };

/**
 * Every test gets the STRICT fake backend + deny-by-default network policy
 * and a record of page errors / console errors. Any request the registry
 * does not allow fails the test; on failure the backend log, the unexpected
 * requests and the page errors are attached next to the screenshot/trace.
 */
export const test = base.extend<Fixtures>({
  // auto: EVERY test talks only to the fake backend - a test can never reach a real host.
  backend: [
    async ({ page, context, baseURL }, use, testInfo) => {
      const log = await installBackend(page);
      await installNetworkGuard(context, new URL(baseURL!).origin, log);
      await use(log);
      if (log.unexpected.length > 0 || testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach('backend-requests.json', { body: JSON.stringify(log.requests, null, 2), contentType: 'application/json' });
      }
      if (log.unexpected.length > 0) {
        await testInfo.attach('unexpected-requests.json', { body: JSON.stringify(log.unexpected, null, 2), contentType: 'application/json' });
        throw new Error(`Unexpected network requests (see unexpected-requests.json):\n${log.unexpected.map(describeUnexpected).join('\n')}`);
      }
    },
    { auto: true },
  ],
  errors: async ({ page }, use, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text().slice(0, 400)}`);
    });
    await use(errors);
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach('page-errors.txt', { body: errors.join('\n') || '(none)', contentType: 'text/plain' });
      await testInfo.attach('screen.png', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    }
  },
});
export { expect };

export const describeUnexpected = (request: UnexpectedRequest) => `  [${request.kind}] ${request.method} ${request.url} - ${request.reason}`;

/**
 * For tests that PROVOKE an unexpected request on purpose: returns the
 * recorded ones and clears them so the teardown check passes.
 */
export function takeUnexpected(log: BackendLog): UnexpectedRequest[] {
  return log.unexpected.splice(0);
}

/**
 * Seed device storage (AsyncStorage = localStorage on web) BEFORE the app
 * boots. `guest` = onboarding done, exploring as a guest, adult mode.
 */
export async function seed(page: Page, options: { language: Language; guest?: boolean; storage?: Record<string, unknown> }) {
  const values: Record<string, string> = { 'oyno.language': options.language };
  if (options.guest) {
    Object.assign(values, { 'oyno.languageChosen': 'true', 'oyno.onboardingComplete': 'true', 'oyno.auth.guestMode': 'true', 'oyno.ageGroup': '18+' });
  }
  for (const [key, value] of Object.entries(options.storage ?? {})) values[key] = typeof value === 'string' ? value : JSON.stringify(value);
  await page.addInitScript((entries) => {
    if (sessionStorage.getItem('e2e-seeded')) return; // only before the first load of the test
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    sessionStorage.setItem('e2e-seeded', '1');
  }, values);
}

/** Parsed value of a device-storage key (AsyncStorage = localStorage on web). */
export async function readStored<T = unknown>(page: Page, key: string): Promise<T | null> {
  const raw = await page.evaluate((storageKey) => localStorage.getItem(storageKey), key);
  return raw === null ? null : (JSON.parse(raw) as T);
}

/** Wait until a stored value satisfies `ready` - persistence is debounced, so never a fixed sleep. */
export async function waitForStored<T = unknown>(page: Page, key: string, ready: (value: T | null) => boolean, message: string) {
  await expect.poll(async () => ready(await readStored<T>(page, key)), { message, timeout: 10_000 }).toBe(true);
}

/** Visible text must not contain raw translation keys (e.g. "gameStats.title"). */
export async function expectNoExposedKeys(page: Page) {
  const text = await page.locator('body').innerText();
  const leaked = [...new Set(text.match(/\b[a-zA-Z][\w-]*(?:\.[\w-]+)+\b/g) ?? [])].filter((token) => KEYS.has(token));
  expect(leaked, `raw i18n keys visible on ${page.url()}`).toEqual([]);
}

/** No horizontal scrolling of the page itself. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const element = document.scrollingElement ?? document.documentElement;
    return element.scrollWidth - element.clientWidth;
  });
  expect(overflow, `horizontal overflow on ${page.url()}`).toBeLessThanOrEqual(1);
}

/** Uncaught page errors fail a journey (console noise is only reported). */
export function expectNoPageErrors(errors: string[]) {
  expect(errors.filter((error) => error.startsWith('pageerror'))).toEqual([]);
}

/**
 * Onboarding Next is available. While a slide transition runs it keeps focus,
 * so on web the unavailable state is aria-busy (see Button
 * keepFocusWhenDisabled) - toBeEnabled() would pass too early.
 */
export async function expectNextAvailable(page: Page, message = 'onboarding Next should be available') {
  await expect(page.getByTestId('onboarding-next'), message).not.toHaveAttribute('aria-busy', 'true');
}

/**
 * One onboarding Next: the button must be available, and ONE tap must land on
 * exactly `slide` (the pager never needs a retry - a dropped or doubled tap
 * fails here with the slide it stopped on).
 */
export async function nextOnboardingSlide(page: Page, slide: number, total = 3) {
  const next = page.getByTestId('onboarding-next');
  await expectNextAvailable(page, `Next should be available before moving to slide ${slide} / ${total}`);
  await next.click();
  await expect(page.getByRole('progressbar'), `one Next tap should land on slide ${slide} / ${total}`).toHaveAttribute('aria-label', `${slide} / ${total}`, { timeout: 5_000 });
}

/** No serious / critical axe violations (WCAG 2.1 A/AA + best practice; 'region' off - see docs/ACCESSIBILITY.md). */
export async function expectNoSeriousViolations(page: Page, label: string) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).disableRules(['region']).analyze();
  const serious = result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(
    serious.map((violation) => `${violation.impact} ${violation.id}: ${violation.help} -> ${violation.nodes.map((node) => node.target.join(' ')).slice(0, 3).join(' | ')}`),
    `axe on ${label}`,
  ).toEqual([]);
}
