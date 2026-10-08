# Oymo Creator - Pattern Recipe (2026-10-08)

- **Player route:** `/culture/oymo/recipe?creation=<saved id>` or
  `?source=session`.
- **Code:**
  - `src/features/culture/oymo/recipe/recipeModel.ts` (pure);
  - `RecipePlayerScreen.tsx`;
  - `src/store/useOymoRecipeStore.ts`.

## What it records - the Creator's own history

There is no second editor.

- The Creator's undo history entries are now `{ state, symmetry, label,
  motifId? }`.
- Every existing editor action pushes one entry with its label: place,
  remove, duplicate, rotate, scale, reorder, visibility, background.
- A **symmetry change** is now an undoable step of its own. Before, it
  wasn't in the history; now Undo also reverts it (tested).
- The recipe is the history up to the current Undo position, with each step
  a COMPLETE replay state (layers, background, symmetry). Stepping to any
  point shows exactly that stage, and the last step is the final design
  (tested against the Creator's own editor functions).

## Limits

- At most **100 steps** and **60,000 bytes** serialized.
- When the history is longer, the EARLIEST steps are left out; the final
  design is always kept, and the first kept step becomes the start.
- The save dialog says so: "the last N of M steps will be saved". The player
  says "N earlier steps weren't kept".

## Saving: optional, owner-bound, backwards compatible

- The save dialog has "Also save the recipe (n steps)". It is off by
  default and only shown to signed-in accounts, the only ones that can
  save creations.
- Recipes are kept on THIS DEVICE, keyed by the owning account (the same
  owner as `oymo_creations`) and by the saved creation's content
  fingerprint. The `save_oymo_creation` RPC returns no id.
- Another account never sees them (tested). Deleting the creation deletes
  its recipe, and recipes survive a restart (tested).
- **Older creations**, and creations saved without a recipe, simply have
  none: no replay button, and the player says so.
- **Backend dependency (not done):** syncing recipes across devices would
  need a new `oymo_creations` column or table plus an RPC change, which is a
  migration. This feature deliberately stays local, and there is no public
  sharing.

## Player

- The stage artwork is drawn by `OymoArtwork` (the canvas's own geometry),
  with "Step n of N · <label>" (for example "Placed Gül", "Changed the
  symmetry").
- Play/Pause, Previous/Next, and a scrubber of labelled step chips; each
  chip reads "Step n of N: label".
- It plays by itself on open, except when **Reduce Motion** is on: then it
  stays manual until Play is pressed. The system setting arrives
  asynchronously and stops the automatic start.
- **"Open this stage as a new design"** hands a deep copy, with a safe next
  layer id, to the Creator as an unsaved design ("A copy of one recipe
  stage…"). The saved creation is never written; e2e checks for no write
  requests.
- **"Replay how this was made"** in the Creator replays the current session
  (memory only), so guests and unsaved designs can replay too.
- Offline and local; KG/RU/EN.

## Tests

- **Unit / screen (`recipe.test.ts`):**
  - final-state equivalence and Undo position;
  - labels in every language;
  - deep stage copies;
  - step and byte limits with trimming;
  - older creations and tampered data;
  - owner isolation, restart persistence, delete;
  - through the real Creator (signed in): edit, then symmetry, then save
    with the recipe, which stores a recipe that replays to exactly the saved
    content, for that owner only;
  - Undo reverts symmetry;
  - saving without a recipe stores none.
- **e2e (`oymo-recipe.spec.ts`):**
  - edit → replay this design → previous / scrubber → open a stage as a copy;
  - reopen a saved creation with its device recipe → replay → copy a
    stage, with no writes;
  - an older creation: no recipe;
  - Reduce Motion stays manual; RU; axe.
  - The e2e backend has no sign-in, so the save-with-recipe step itself is
    covered by the screen-level test.

## Device checks: PENDING

- [ ] Signed-in save with the recipe on iOS and Android, then reopen after
  an app restart.
- [ ] VoiceOver / TalkBack read the step chips and the stage label.
