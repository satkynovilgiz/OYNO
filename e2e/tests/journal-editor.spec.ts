import { expect, expectNoExposedKeys, expectNoPageErrors, readStored, seed, test, waitForStored } from '../helpers';

/**
 * Journal editor: leaving with unsaved changes, and recovering unfinished
 * writing after a restart (a page reload = a fresh app process; device
 * storage survives). Photos, Android hardware back and the iOS swipe are
 * device checks - see docs/DEVICE_QA.md.
 */

const AT = '2026-09-20T08:00:00.000Z';
const ENTRY_ID = '0b3f0c5e-1d8a-4f2e-9c1b-2a7d5e6f8a90';
const entry = { id: ENTRY_ID, title: 'Yurt visit', note: 'Felt walls and a warm stove', date: '2026-09-20', photo: null, link: null, createdAt: AT, updatedAt: AT, deletedAt: null };
const DRAFTS = 'oyno.journal.drafts.v1';
const JOURNAL = 'oyno.journal.v1';
// Synthetic text only.
const UNSAVED = 'Unsaved line about the lake 3k9d';

type Drafts = Record<string, Record<string, { fields: { note: string; title: string }; entryId: string }>>;
type Entries = { id: string; title: string; note: string; deletedAt: string | null }[];

const leaveDialog = (page: import('@playwright/test').Page) => page.getByTestId('journal-leave-dialog');
const restoreDialog = (page: import('@playwright/test').Page) => page.getByTestId('journal-restore-dialog');

test('opening and leaving an unchanged entry never warns', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true, storage: { [JOURNAL]: [entry] } });
  await page.goto('/journal');
  await page.getByText('Yurt visit').first().click();
  await expect(page).toHaveURL(new RegExp(`/journal/${ENTRY_ID}`));
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByTestId('journal-title')).toHaveValue('Yurt visit');
  // Back from the form: straight to the detail view, then out - no dialog.
  await page.getByTestId('journal-back').click();
  await expect(leaveDialog(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
  await page.getByTestId('journal-back').click();
  await expect(page).toHaveURL(/\/journal$/);
  await expect(leaveDialog(page)).toHaveCount(0);
  expect(await readStored(page, DRAFTS)).toBeNull();
  expectNoPageErrors(errors);
});

test('unsaved writing survives a restart; restoring and saving makes exactly one entry', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/journal/new');
  await page.getByTestId('journal-note').fill(UNSAVED);
  await waitForStored<Drafts>(page, DRAFTS, (drafts) => drafts?.guest?.new?.fields.note === UNSAVED, 'the draft should be written after typing pauses');
  const draftEntryId = (await readStored<Drafts>(page, DRAFTS))!.guest.new.entryId;

  await page.reload();
  await expect(restoreDialog(page)).toBeVisible();
  await expect(restoreDialog(page)).toContainText("didn't save it");
  await page.getByTestId('journal-restore').click();
  await expect(page.getByTestId('journal-note')).toHaveValue(UNSAVED);

  await page.getByTestId('journal-save').click();
  // The restored draft keeps its pre-allocated id.
  await expect(page).toHaveURL(new RegExp(`/journal/${draftEntryId}`));
  await waitForStored<Entries>(page, JOURNAL, (entries) => (entries ?? []).filter((item) => !item.deletedAt).length === 1, 'exactly one entry is saved');
  await waitForStored<Drafts>(page, DRAFTS, (drafts) => !drafts?.guest?.new, 'the draft is cleared only after the save succeeded');

  // Nothing left to restore on the next new memory.
  await page.goto('/journal/new');
  await expect(page.getByTestId('journal-note')).toBeVisible();
  await expect(restoreDialog(page)).toHaveCount(0);
  await expectNoExposedKeys(page);
  expectNoPageErrors(errors);
});

test('leaving a dirty new memory asks first: Keep editing keeps it, Discard drops it', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/journal');
  await page.getByRole('button', { name: 'New memory' }).first().click();
  await expect(page).toHaveURL(/\/journal\/new/);
  const note = page.getByTestId('journal-note');
  await note.fill(UNSAVED);

  await page.getByTestId('journal-back').click();
  await expect(leaveDialog(page)).toBeVisible();
  for (const name of ['Save', 'Discard changes', 'Keep editing']) await expect(leaveDialog(page).getByRole('button', { name })).toBeVisible();
  await page.getByTestId('journal-leave-keep').click();
  await expect(leaveDialog(page)).toHaveCount(0);
  await expect(note).toHaveValue(UNSAVED);

  await page.getByTestId('journal-back').click();
  await page.getByTestId('journal-leave-discard').click();
  await expect(page).toHaveURL(/\/journal$/);
  await waitForStored<Drafts>(page, DRAFTS, (drafts) => !drafts?.guest?.new, 'Discard removes the draft');
  expect(((await readStored<Entries>(page, JOURNAL)) ?? []).length).toBe(0);

  // And it stays gone after a restart.
  await page.goto('/journal/new');
  await expect(page.getByTestId('journal-note')).toBeVisible();
  await expect(restoreDialog(page)).toHaveCount(0);
  expectNoPageErrors(errors);
});

test('Save in the leave dialog saves the edit and then leaves', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true, storage: { [JOURNAL]: [entry] } });
  await page.goto('/journal');
  await page.getByText('Yurt visit').first().click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByTestId('journal-title').fill('Yurt visit, day two');
  await page.getByTestId('journal-back').click();
  await page.getByTestId('journal-leave-save').click();
  await expect(leaveDialog(page)).toHaveCount(0);
  // Back from the form = the detail view, now showing the saved title.
  await expect(page.getByRole('heading', { name: 'Yurt visit, day two' })).toBeVisible();
  await waitForStored<Entries>(page, JOURNAL, (entries) => entries?.[0]?.title === 'Yurt visit, day two', 'the edit is stored');
  await waitForStored<Drafts>(page, DRAFTS, (drafts) => !drafts?.guest?.[ENTRY_ID], 'no draft remains');
  expectNoPageErrors(errors);
});

test('an edit left by a restart offers Restore or Discard; Discard keeps the saved version', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true, storage: { [JOURNAL]: [entry] } });
  await page.goto(`/journal/${ENTRY_ID}`);
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByTestId('journal-note').fill(UNSAVED);
  await waitForStored<Drafts>(page, DRAFTS, (drafts) => drafts?.guest?.[ENTRY_ID]?.fields.note === UNSAVED, 'the edit draft is written');

  await page.reload();
  await expect(restoreDialog(page)).toBeVisible();
  await page.getByTestId('journal-restore-discard').click();
  await expect(page.getByText('Felt walls and a warm stove')).toBeVisible();
  await waitForStored<Drafts>(page, DRAFTS, (drafts) => !drafts?.guest?.[ENTRY_ID], 'Discard removes the draft');
  expect((await readStored<Entries>(page, JOURNAL))![0].note).toBe('Felt walls and a warm stove');
  expectNoPageErrors(errors);
});

test('router navigation away (browser back) is held for the same choice', async ({ page, errors }) => {
  await seed(page, { language: 'en', guest: true });
  await page.goto('/journal');
  await page.getByRole('button', { name: 'New memory' }).first().click();
  await page.getByTestId('journal-note').fill(UNSAVED);
  await page.goBack();
  // The screen is NOT removed until the person chooses.
  await expect(leaveDialog(page)).toBeVisible();
  await expect(page.getByTestId('journal-note')).toHaveValue(UNSAVED);
  await page.getByTestId('journal-leave-discard').click();
  await expect(page.getByTestId('journal-note')).toHaveCount(0);
  await expect(page).toHaveURL(/\/journal$/);
  await waitForStored<Drafts>(page, DRAFTS, (drafts) => !drafts?.guest?.new, 'Discard removes the draft');
  expectNoPageErrors(errors);
});
