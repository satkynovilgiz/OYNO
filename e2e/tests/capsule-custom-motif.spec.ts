import { expect, expectNoExposedKeys, expectNoPageErrors, readStored, seed, test } from '../helpers';

/** Time Capsule + custom motifs (capsuleModel.ts, customMotifModel.ts carryEmbedded): geometry survives save/reopen; an unreadable embed stays a placeholder. */
const AT = '2026-10-01T10:00:00.000Z';
const PRIMITIVES = [
  {
    kind: 'polygon',
    points: [
      [2, 2],
      [22, 2],
      [12, 20],
    ],
  },
  { kind: 'circle', cx: 12, cy: 12, r: 4 },
];
const MOTIF = { format: 'oyno.customMotif', v: 1, id: 'cm-synthetic7c', name: 'Synthetic star 7c', primitives: PRIMITIVES, updatedAt: AT };
type StoredCapsule = { id: string; design: { layers: { motifId: string; custom?: unknown }[] } | null };

test('custom motif -> Creator -> capsule -> save -> reopen keeps the geometry', async ({ page, errors }) => {
  await page.clock.install({ time: new Date('2026-10-10T10:00:00') });
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.customMotifs.v1': { guest: { [MOTIF.id]: MOTIF } } } });
  await page.goto(`/culture/oymo/motifs/${MOTIF.id}`);
  await page.getByTestId('custom-motif-place').locator('visible=true').first().click();
  await expect(page).toHaveURL(/\/culture\/oymo\/create/);
  await page.getByTestId('oymo-to-capsule').click();
  await expect(page).toHaveURL(/\/profile\/capsules\/new$/);
  await page.getByTestId('capsule-title').fill('Synthetic capsule with a custom motif');
  await page.getByTestId('capsule-message').fill('Synthetic message 3q');
  await page.getByTestId('capsule-quick-week').click();
  await page.getByTestId('capsule-save-draft').click();
  await expect(page).toHaveURL(/\/profile\/capsules\/tc/);

  const stored = (await readStored<Record<string, StoredCapsule[]>>(page, 'oyno.timeCapsules.v1'))!.guest;
  expect(stored[0].design!.layers[0]).toMatchObject({ motifId: `custom:${MOTIF.id}`, custom: { v: 1, name: MOTIF.name, primitives: PRIMITIVES } });

  // Reopen after a restart: drawn from the embedded geometry, not the placeholder.
  await page.reload();
  const design = page.getByTestId('capsule-design');
  await expect(design.locator('path, circle, polygon').first()).toBeAttached();
  await expect(design.locator(`[aria-label="A user-created motif in a format this version can't show"]`)).toHaveCount(0);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('an embed from a newer version shows the placeholder and is kept when the draft is saved again', async ({ page, errors }) => {
  const newer = { v: 2, name: 'From a newer app', primitives: [{ kind: 'bezier', d: [1, 2, 3] }] };
  const capsule = {
    id: 'tccustom1',
    status: 'draft',
    title: 'Synthetic capsule 8w',
    message: 'Synthetic message 8w',
    articles: [],
    openOn: '2027-10-01',
    createdAt: AT,
    sealedAt: null,
    openedAt: null,
    openedEarly: false,
    reflection: '',
    reflectedAt: null,
    design: { layers: [{ id: 'layer0', motifId: 'custom:cm-newer8w', color: '#7A3226', point: { x: 150, y: 150 }, rotation: 0, scale: 1, visible: true, custom: newer }], backgroundColor: '#EADCC0', symmetry: 'none', takenAt: AT },
  };
  await seed(page, { language: 'en', guest: true, storage: { 'oyno.timeCapsules.v1': { guest: [capsule] } } });
  await page.goto('/profile/capsules/tccustom1');
  await expect(page.getByTestId('capsule-design').locator(`[aria-label="A user-created motif in a format this version can't show"]`)).toHaveCount(1);
  await page.getByTestId('capsule-title').fill('Synthetic capsule 8w, edited');
  await page.getByTestId('capsule-save-draft').click();
  await expect
    .poll(async () => (await readStored<Record<string, StoredCapsule[]>>(page, 'oyno.timeCapsules.v1'))!.guest[0])
    .toMatchObject({ title: 'Synthetic capsule 8w, edited', design: { layers: [{ motifId: 'custom:cm-newer8w', custom: newer }] } });
  expectNoPageErrors(errors);
});
