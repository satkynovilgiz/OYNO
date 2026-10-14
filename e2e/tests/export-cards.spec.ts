import { expect, expectNoExposedKeys, expectNoPageErrors, expectNoSeriousViolations, LANGUAGES, seed, test } from '../helpers';

/** Export cards (docs/EXPORT_CARDS.md): one fit rule with a visible note, styles, approved fields only. */
const AT = '2026-10-01T10:00:00.000Z';
const LONG = {
  kg: 'Кыргыз боз үйүнүн түндүгү жана анын үй-бүлөнүн муундан муунга өткөн салттуу мааниси тууралуу узун аталыш',
  ru: 'Тюндюк кыргызской юрты и его традиционное значение для семьи, передаваемое из поколения в поколение',
  en: 'The tündük of the Kyrgyz yurt and its traditional meaning for a family, handed down from generation to generation',
} as const;
const NOTE = 'Synthetic private journal note 4k';
const LABELS = { en: ['Share', 'Share card'], ru: ['Поделиться', 'Поделиться'], kg: ['Бөлүшүү', 'Бөлүшүү'] } as const;

for (const language of LANGUAGES) {
  test(`long ${language.toUpperCase()} title stays inside the card, shortened with a visible note; the private note never appears`, async ({ page, errors }) => {
    await page.setViewportSize({ width: 390, height: 860 });
    await seed(page, { language, guest: true, storage: { 'oyno.journal.v1': [{ id: 'e1', title: LONG[language], note: NOTE, date: '2026-10-01', photo: null, link: null, createdAt: AT, updatedAt: AT, deletedAt: null }] } });
    await page.goto('/journal/e1');
    const [share, confirm] = LABELS[language];
    await page.getByRole('button', { name: share, exact: true }).first().click();
    await page.getByRole('button', { name: confirm, exact: true }).last().click();
    const card = page.getByTestId('share-preview-card');
    await expect(card.getByTestId('share-card-journal')).toBeVisible();
    await expect(card.getByTestId('share-card-shortened')).toBeVisible();
    await expect(card).not.toContainText(NOTE);
    // The title sits inside the card's box.
    const outer = (await card.boundingBox())!;
    const title = (await card.getByTestId('share-card-title').boundingBox())!;
    expect(title.x).toBeGreaterThanOrEqual(outer.x - 1);
    expect(title.x + title.width).toBeLessThanOrEqual(outer.x + outer.width + 1);
    expect(title.y + title.height).toBeLessThanOrEqual(outer.y + outer.height + 1);
    await expectNoExposedKeys(page);
    await page.screenshot({ path: `e2e/.results/export-journal-long-${language}.png` });
    expectNoPageErrors(errors);
  });
}

test('a design card: preview = export content, three styles, artwork whole; nothing private', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await seed(page, { language: 'en', guest: true });
  await page.goto('/culture/oymo/create');
  await page.getByRole('button', { name: 'Place at center' }).click();
  await page.getByLabel('Share design', { exact: true }).click();
  const card = page.getByTestId('share-preview-card');
  await expect(card.getByTestId('share-card-creation-paper')).toBeVisible();
  await expect(card.getByTestId('share-card-artwork')).toBeVisible();
  await expect(card.getByTestId('share-card-shortened')).toHaveCount(0);
  await expect(page.getByTestId('share-style-paper')).toHaveAttribute('aria-checked', 'true');
  await expectNoSeriousViolations(page, 'share preview with styles');
  for (const id of ['forest', 'felt'] as const) {
    await page.getByTestId(`share-style-${id}`).click();
    await expect(card.getByTestId(`share-card-creation-${id}`)).toBeVisible();
    await page.screenshot({ path: `e2e/.results/export-creation-${id}.png` });
  }
  await expect(card).not.toContainText('guest');
  expectNoPageErrors(errors);
});
