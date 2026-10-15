import { expect, expectNoExposedKeys, expectNoHorizontalOverflow, expectNoPageErrors, expectNoSeriousViolations, readStored, seed, test } from '../helpers';

/** Project workspaces (docs/PROJECT_WORKSPACE.md): workspace -> edit -> return -> preview, a private note kept out of exports, a deleted project. */
const AT = '2026-10-01T10:00:00.000Z';
const ID = 'uc_workspace_test';
const KEY = `exhibition:${ID}`;
const NOTE = 'Synthetic private plan 5z';
const item = (contentId: string, sortOrder: number) => ({ collectionId: ID, contentType: 'culture_item', contentId, sortOrder, addedAt: AT });
const collections = { guest: { collections: [{ id: ID, name: 'Yurt things', description: null, createdAt: AT, updatedAt: AT }], items: [item('boz-uy-tunduk', 0), item('boz-uy-overview', 1)] } };
const museums = { guest: { [ID]: { title: 'The yurt', intro: '', exhibits: ['culture_item:boz-uy-tunduk', 'culture_item:boz-uy-overview'], captions: {}, reflections: {}, updatedAt: AT } } };
const STORAGE = { 'oyno.myCollections.v1': collections, 'oyno.myCollections.museums.v1': museums };

test('choose a project -> note -> edit -> return (live title) -> Home -> visitor preview; the note never reaches the project or the export', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await seed(page, { language: 'en', guest: true, storage: STORAGE });
  await page.goto('/profile/workspaces');
  await expect(page.getByTestId('workspaces-choose-design')).toContainText('sign in'); // designs live in the account: a guest is told, not shown "empty"
  await page.getByTestId(`workspaces-open-${KEY}`).click();
  await expect(page).toHaveURL(/\/profile\/workspaces\/exhibition/);
  await expect(page.getByTestId('workspace-project-title')).toHaveText('The yurt');
  await expect(page.getByTestId('workspace-saved-record')).toContainText('On this device');
  await expect(page.getByTestId('workspace-drafts')).toContainText('saved as you make them');
  await expectNoSeriousViolations(page, 'workspace');
  await expectNoHorizontalOverflow(page);

  // A private note: unsaved until saved, then stored with the workspace only.
  await page.getByTestId('workspace-note-input').fill(NOTE);
  await expect(page.getByTestId('workspace-note-state')).toHaveText('Note has unsaved changes');
  await page.getByTestId('workspace-note-save').click();
  await expect(page.getByTestId('workspace-note-state')).toHaveText('Note saved');
  expect((await readStored<Record<string, Record<string, { note: string }>>>(page, 'oyno.projectWorkspaces.v1'))?.guest?.[KEY]?.note).toBe(NOTE);
  await page.screenshot({ path: 'e2e/.results/project-workspace.png' });

  // Edit: the existing Mini Museum editor opens; the change is made there.
  await page.getByTestId('workspace-action-edit').click();
  await expect(page.getByTestId('museum-setup')).toBeVisible();
  await page.getByTestId('museum-title').fill('The yurt, rearranged');
  await page.goBack();
  // Return: the workspace reads the live record; the note is still there.
  await expect(page.getByTestId('workspace-project-title')).toHaveText('The yurt, rearranged');
  await expect(page.getByTestId('workspace-note-input')).toHaveValue(NOTE);
  const stored = await readStored<typeof museums>(page, 'oyno.myCollections.museums.v1');
  expect(JSON.stringify(stored)).not.toContain(NOTE);

  // Back from Home.
  await page.goto('/home');
  await page.getByTestId(`home-workspace-${KEY}`).click();
  await expect(page.getByTestId('workspace-project-title')).toHaveText('The yurt, rearranged');

  // Export: the cover card only.
  await page.getByTestId('workspace-action-share').click();
  const card = page.getByTestId('share-preview-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('The yurt, rearranged');
  await expect(card).not.toContainText(NOTE);
  await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
  await expect(card).toHaveCount(0);

  // Preview: the museum's own Visitor Preview.
  await page.getByTestId('workspace-action-visitorPreview').click();
  await expect(page.getByTestId('preview-start')).toBeVisible();
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('a deleted project is unavailable, keeps its note, and the workspace can be removed (RU)', async ({ page, errors }) => {
  const workspaces = { guest: { 'exhibition:uc_gone': { type: 'exhibition', id: 'uc_gone', note: NOTE, titleSnapshot: 'Synthetic old show 2g', createdAt: AT, updatedAt: AT, openedAt: AT } } };
  await seed(page, { language: 'ru', guest: true, storage: { ...STORAGE, 'oyno.projectWorkspaces.v1': workspaces } });
  await page.goto('/profile/workspaces');
  await expect(page.getByTestId('workspaces-item-exhibition:uc_gone')).toContainText('Этой выставки больше нет');
  await page.getByTestId('workspaces-item-exhibition:uc_gone').click();
  await expect(page.getByTestId('workspace-project-missing')).toBeVisible();
  await expect(page.getByTestId('workspace-action-edit')).toHaveCount(0);
  await expect(page.getByTestId('workspace-note-input')).toHaveValue(NOTE);
  await expectNoSeriousViolations(page, 'missing project');
  await page.getByTestId('workspace-missing-remove').click();
  await page.getByRole('button', { name: 'Удалить', exact: true }).last().click();
  await expect(page).toHaveURL(/\/profile\/workspaces$/);
  expect((await readStored<Record<string, unknown>>(page, 'oyno.projectWorkspaces.v1'))?.guest).toBeUndefined();
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});
