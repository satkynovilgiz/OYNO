import { FIXTURE_TABLES } from '../fixtures/data';
import { generateQuests, shortestRoute } from '../../src/features/culture/connections/questModel';
import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, seed, test } from '../helpers';

/** Connection Quest: start -> follow -> read a source -> return -> reach the destination (offered quests are solvable with the fixture content). */

const available = new Set((FIXTURE_TABLES.culture_items as { id: string }[]).map((row) => row.id));
const exists = (_type: string, id: string) => available.has(id);

test('start -> follow -> read source -> return -> reach destination; the route shows its evidence', async ({ page, errors }) => {
  const quests = generateQuests(exists);
  expect(quests.length).toBeGreaterThan(0);
  const quest = quests.find((entry) => entry.steps >= 2)!;
  const route = shortestRoute(quest.start, quest.destination, exists)!;

  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/connections/trail?start=boz-uy-karkas');
  await page.getByTestId('quest-entry').click();
  await expect(page).toHaveURL(/\/culture\/connections\/quest$/);
  await page.getByTestId(`quest-${quest.id}`).click();
  await expect(page.getByTestId('quest-destination')).toBeVisible();

  for (const [index, entry] of route.entries()) {
    await expect(page.getByTestId('quest-destination')).toBeVisible(); // always in view
    if (index === 0) {
      // A hint points along a real route.
      await page.getByTestId('quest-hint-button').click();
      await expect(page.getByTestId('quest-hint')).toBeVisible();
      // Read the source of the link, come back: the quest is still where it was.
      await page.getByTestId(`quest-source-${entry.otherId}`).click();
      await expect(page).toHaveURL(/\/culture\/item\//);
      await page.goBack();
      await expect(page.getByTestId('quest-step-0')).toBeVisible();
    }
    await page.getByTestId(`quest-follow-${entry.otherId}`).click();
  }
  await expect(page.getByTestId('quest-arrived')).toBeVisible();
  for (let index = 0; index < route.length; index += 1) await expect(page.getByTestId(`quest-route-${index}`)).toContainText('“');
  await expect(page.getByText('nothing is scored or saved')).toBeVisible();
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('retrace and restart keep the quest; KG/RU; accessible', async ({ page, errors }) => {
  const quest = generateQuests(exists).find((entry) => entry.steps >= 2)!;
  const route = shortestRoute(quest.start, quest.destination, exists)!;
  await seed(page, { language: 'ru', guest: true });
  await page.goto('/culture/connections/quest');
  await expectNoSeriousViolations(page, 'quest pick');
  await page.getByTestId(`quest-${quest.id}`).click();
  await page.getByTestId(`quest-follow-${route[0].otherId}`).click();
  await expect(page.getByTestId('quest-step-1')).toBeVisible();
  await page.getByTestId('quest-step-0').click();
  await expect(page.getByTestId('quest-step-1')).toBeVisible(); // later step stays listed
  await page.getByTestId('quest-restart').click();
  await expect(page.getByTestId('quest-step-1')).toHaveCount(0);
  await expectNoExposedKeys(page);
  await expectNoSeriousViolations(page, 'quest play');
  expectNoPageErrors(errors);
});
