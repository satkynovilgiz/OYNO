import type { Page } from '@playwright/test';

import en from '../../src/i18n/locales/en.json';
import ru from '../../src/i18n/locales/ru.json';
import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Map Challenge on the illustrated map - offline content, no timer, not a visit. */

const names = (en as unknown as { mapChallenge: { names: Record<string, string> } }).mapChallenge.names;
const idByName = Object.fromEntries(Object.entries(names).map(([id, name]) => [name, id]));

async function currentTarget(page: Page): Promise<string> {
  const prompt = await page.getByTestId('map-challenge-prompt').innerText();
  return idByName[prompt.replace(/^Find this (region|place): /, '')];
}

test('a complete session: hidden labels, three ways to answer, sourced feedback, mistakes review', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/explore/map');
  await page.getByTestId('map-challenge-entry').click();
  await expect(page).toHaveURL(/\/explore\/map-challenge/);
  await expect(page.getByText("Playing doesn't count as visiting")).toBeVisible();
  const before = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).filter((key) => /progress|passport|visit|daily/i.test(key)).map((key) => [key, localStorage.getItem(key)])));
  await page.getByTestId('map-challenge-start').click();

  const asked: string[] = [];
  for (let index = 0; index < 5; index += 1) {
    await expect(page.getByText(`Question ${index + 1} of 5`)).toBeVisible();
    const target = await currentTarget(page);
    asked.push(target);
    // Labels that would give the answer away are covered; markers are numbered, not named.
    await expect(page.getByTestId('map-challenge-mask')).toHaveCount(7);
    const markerLabels = await page.locator('[data-testid^="map-challenge-marker-"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
    for (const label of markerLabels) expect(label).toMatch(/^Map marker \d+$/);

    if (index === 0) {
      await page.getByTestId(`map-challenge-option-${target}`).click(); // list alternative
    } else if (index === 1) {
      await page.getByTestId(`map-challenge-marker-${target}`).click(); // marker
    } else if (index === 2) {
      // A tap on the map art right next to the target marker.
      const box = (await page.getByTestId(`map-challenge-marker-${target}`).boundingBox())!;
      await page.mouse.click(box.x + box.width / 2 + 6, box.y + box.height / 2 + 4);
    } else if (index === 3) {
      // Deliberately wrong (from the list).
      const wrong = await page.locator('[data-testid^="map-challenge-option-"]').evaluateAll((nodes, right) => nodes.map((node) => node.getAttribute('data-testid')!.replace('map-challenge-option-', '')).find((id) => id !== right)!, target);
      await page.getByTestId(`map-challenge-option-${wrong}`).click();
    } else {
      await page.getByTestId(`map-challenge-option-${target}`).click();
    }

    const feedback = page.getByTestId('map-challenge-feedback');
    await expect(feedback).toBeVisible();
    // The right region is identified - on the map and in words - and labels are back.
    await expect(page.getByTestId('map-challenge-answer-label')).toHaveText(names[target]);
    await expect(feedback).toContainText(index === 3 ? `${names[target]} is highlighted` : `Right - that's ${names[target]}.`);
    await expect(page.getByTestId('map-challenge-mask')).toHaveCount(0);
    if (index === 0) {
      await page.getByTestId('map-challenge-open').click();
      await expect(page).toHaveURL(new RegExp(target === 'suusamyr' || target === 'arslanbob' ? `/explore/${target}$` : `/explore/region/${target}$`));
      await page.goBack();
      await expect(page.getByTestId('map-challenge-feedback')).toBeVisible();
    }
    await page.getByTestId('map-challenge-next').click();
  }
  expect(new Set(asked).size).toBe(5);

  await expect(page.getByTestId('map-challenge-score')).toHaveText('Correct: 4 of 5');
  await expect(page.getByTestId(/^map-challenge-mistake-/)).toHaveCount(1);
  // Visits / passport untouched.
  expect(await page.evaluate(() => JSON.stringify(Object.keys(localStorage).filter((key) => /progress|passport|visit|daily/i.test(key)).map((key) => [key, localStorage.getItem(key)])))).toBe(before);

  await page.getByTestId('map-challenge-practise').click();
  await expect(page.getByText('Question 1 of 1')).toBeVisible();
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

for (const width of [320, 768, 1280]) {
  test(`selection lands on the right marker at ${width}px`, async ({ page, errors }) => {
    await page.setViewportSize({ width, height: 900 });
    await seed(page, { language: 'ru', guest: true });
    await page.goto('/explore/map-challenge');
    await page.getByTestId('map-challenge-start').click();
    const ruNames = ru as unknown as { mapChallenge: { names: Record<string, string> } };
    const prompt = await page.getByTestId('map-challenge-prompt').innerText();
    const target = Object.entries(ruNames.mapChallenge.names).find(([, name]) => prompt.endsWith(`: ${name}`))![0];
    const box = (await page.getByTestId(`map-challenge-marker-${target}`).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByTestId('map-challenge-feedback')).toContainText('Верно');
    expectNoPageErrors(errors);
  });
}

test('accessible: question and feedback', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/explore/map-challenge');
  await expectNoSeriousViolations(page, 'map challenge intro');
  await page.getByTestId('map-challenge-start').click();
  await expectNoSeriousViolations(page, 'map challenge question');
  await page.locator('[data-testid^="map-challenge-option-"]').first().click();
  await expectNoSeriousViolations(page, 'map challenge feedback');
  expectNoPageErrors(errors);
});
