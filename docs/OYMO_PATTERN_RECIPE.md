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

## Saving: optional, owner + creation id (revised 2026-10-08)

- "Also save the recipe" is off by default and signed-in only.
- Recipes are stored on THIS DEVICE under `oyno.oymoRecipes.v2`, as
  `{ <owner>: { byCreation: { <creationId>: … }, legacy: {…} } }`.
- **How the id is found:** `save_oymo_creation` returns no id (checked: it
  inserts and returns only `{ progress }`). The Creator notes the creation
  ids that exist before saving, refetches the creations afterwards, and
  attaches the recipe to the ONE new row with the saved content. With zero
  or several such rows, nothing is attached rather than guessing.
- **What that guarantees:**
  - Two identical creations have independent recipes.
  - Deleting one removes only its own recipe.
  - A creation saved without a recipe never inherits another's.
  - Other accounts never see a recipe (all tested).

### Migration from v1 (content fingerprints)

- On load, v1 entries are kept as that owner's `legacy`. The v1 key is
  removed only AFTER the v2 write has succeeded; if that write fails, v1 is
  kept and the migration runs again on the next launch.
- Adoption runs only once recipe storage has finished loading. The Creator
  and the player both retry it when loading completes, so storage that loads
  after the creation list still adopts.
- When that owner's creations are known (in the Creator or the player), a
  legacy recipe is adopted by a creation only when EXACTLY ONE creation has
  that content.
  - An ambiguous one (two or more identical creations, or none) stays
    unassigned and is never shown.
  - If the identical twins later reduce to one, that one adopts it.
- v1 existed for less than a day, so few if any devices have it.

### Session recipes

- The unsaved session's recipe is bound to the owner who made it (memory
  only).
- Another account, after a sign-out or a switch, gets nothing, and the
  stale session is cleared. A direct visit to `?source=session` by anyone
  else shows "nothing to replay".
- The Creator also drops the session when the account changes.
- Opening a stage still hands over a deep copy.

### Backend dependency (not done)

Returning the new id from the RPC, or syncing recipes across devices,
would need a migration. Neither is done.

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
