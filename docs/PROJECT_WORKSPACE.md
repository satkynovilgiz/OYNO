# Project workspaces

Profile → **Project workspaces** (`/profile/workspaces`). A personal page for one existing **Oymo design** or **Mini Museum exhibition**: its editing, preview and export actions in one place, a private note, and an honest status.

## What was reused (nothing copied)

- **Projects:** read through the My OYNO Shelf adapters (`shelfModel.ts`). The source hook `useShelfSources` was moved out of `ShelfScreen` and is now shared. The workspace stores only the project's **type and stable id** (`design:<creation id>` or `exhibition:<collection id>`, the same keys the Shelf uses).
- **Editing, preview and export:** every action opens the project's existing screen or share card. The workspace has no editor and no storage of its own for the project.
- **Drafts:** shown from the editors' own draft sources, the same ones the Recovery Center lists (`draftRegistry`).
- **Tags and portfolios:** inspected. Portfolios reference designs by id, so a portfolio's unsaved edits that include a design appear as a related draft. Tags were not used.

## Actions per type (`actionsFor`)

| Group | Oymo design | Mini Museum exhibition |
|---|---|---|
| Edit | Edit in the Creator (`/culture/oymo/create?creation=<id>`), Milestones | Edit the exhibition (`/profile/my-collections/museum?collection=<id>`), Open the collection |
| Preview | Preview on surfaces (the existing surface preview, given the saved design) | Visitor preview (the museum's own preview, entered through `keepPreview`) |
| Export | Make a postcard, Share image (the Creator's share card) | Share cover (the museum's cover card, without the introduction) |

- Each group is a labelled `role="group"` with a header. Each action has an accessibility hint.
- Unit tests check that every route exists.

## Saved record vs. recoverable drafts

- **Saved record:** where the project lives ("Saved to your account" or "On this device") and when it last changed, read from the live record.
- **Recoverable drafts** (shown separately):
  - unsaved design-portfolio edits that include this design, with a link to open the portfolio;
  - an unsaved workspace note.
- **What each type can't have**, stated rather than guessed:
  - The Creator keeps unsaved changes only while it is open (it has no draft store).
  - Exhibitions save every change as it is made.

## The private note

- It is labelled private. It is never part of the project, and never passed to a share card or export (unit and E2E tests check this).
- Saving uses the per-owner `useWorkspaceStore` (`oyno.projectWorkspaces.v1`): serialized and write-first, the same pattern as the other record stores.
  - A failed write changes nothing.
  - An unreadable store is an error with Retry, and blocks writes.
- **Edits made while a save is pending are kept.**
  - The typed text lives in the editor and in an in-memory draft (`draftMap('workspaceNote')`).
  - After a successful save, the draft is cleared only if it is still exactly what was sent.
  - Anything typed meanwhile stays, marked "Note has unsaved changes".
- A failed save keeps the text and says so.
- The draft is listed in the **Recovery Center** (new kind `workspaceNote`). Retry there is offered only while the workspace still exists; it is an update, so it can't create anything.

## Returning to a project

- **Home:** "Your projects" lists the three most recently opened workspaces, under the shortcuts. It is shown only once there is one, never blocks Home, and is hidden on a load error.
  - Home shows the title last seen (`titleSnapshot`), so Home doesn't fetch designs.
  - The workspace itself always shows the live title, and refreshes the snapshot when opened.
- **Shelf:** each design and exhibition has an "Open workspace" button beside it. The first open adds the workspace.
- **List:** `/profile/workspaces` lists your workspaces, then existing projects to open one for (at most 30).

## States

- **Loading** stays loading, never "missing".
- **Load error:** Retry.
- **Unavailable:**
  - designs for a guest: "Sign in";
  - offline before the designs loaded.
- **Missing** (the project was deleted):
  - "This design is no longer saved" or "This exhibition no longer exists";
  - no project actions;
  - the note is still readable;
  - options: **Remove workspace** (with confirmation; the project is not touched) or **Go to My OYNO Shelf**.
- **Not added yet** (a deep link, or an add that failed): "Add to my workspaces", with an error and Retry if the write fails.
- **Account switching:** the body is keyed by owner, so the previous owner's workspace, note and draft disappear at once (unit-tested).

## Tests

- **Unit:** `src/features/workspace/workspace.test.ts`, 18 tests:
  - keys and validation;
  - resolution (ready, missing only from a ready source, loading, unavailable, error);
  - actions per type, with every route existing;
  - add, note, open and remove, bounds, and normalization;
  - recency order;
  - related drafts and note state;
  - the store: per owner, restart, serialized rapid writes, a failed write, an unreadable store, and that a note never touches museums;
  - Recovery: owner-only listing, a parent that is ok, missing or loading, Retry saving the current note, Discard;
  - the screen:
    - action routes;
    - export without the note;
    - an edit typed during a pending save is kept;
    - a failed save keeps the text and the draft;
    - a deleted project versus a loading one;
    - an account switch;
    - an invalid key.
- **E2E:** `e2e/tests/project-workspace.spec.ts`:
  - list (designs: "sign in" for a guest) → open an exhibition workspace;
  - axe and no overflow;
  - note unsaved → saved, stored only in the workspace store;
  - **Edit** in the Mini Museum → back: the live title, the note kept, and museum storage free of the note;
  - **Home** → workspace;
  - **Share cover**, without the note;
  - **Visitor preview** opens;
  - RU: a deleted exhibition is unavailable with its note, axe passes, and Remove with confirmation empties the store.
- **Not E2E-tested:** design workspaces, because the E2E backend has no sign-in (the same limit as the Shelf). They are covered by the unit tests.

## Pending (not verified on devices)

- VoiceOver and TalkBack reading of the action groups and hints.
- The Shelf row's second button with Dynamic Type at the largest sizes.
