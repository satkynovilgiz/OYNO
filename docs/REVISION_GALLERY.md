# Revision Gallery (design milestones)

**Code:** `src/features/culture/oymo/milestones/` (`milestonesModel.ts`, `MilestoneBar.tsx`,
`MilestoneScreens.tsx`) and `src/store/useOymoMilestonesStore.ts` (`oyno.oymoMilestones.v1`).
**Routes:** `/culture/oymo/milestones` (designs with milestones) and
`/culture/oymo/milestones/[creationId]`, which is private in the route sanitizer.

## How it works

- **Where it appears:** in the Creator, for a design opened from a **saved creation**. That
  creation is the milestone parent; it stays the parent while you edit, and is cleared by Reset.
- **Saving:** **Save a milestone** takes an optional label of up to 40 characters and stores a
  deep copy of the design as it is at the tap. It says "saved" only after the write succeeded.
  - Edits made while a save is pending don't affect the snapshot.
  - A label typed during a pending save is kept.
  - A failed save keeps the design and the label, with Retry.
- **Kept apart from other history:** milestones are separate from Undo (temporary, in memory)
  and from Pattern Recipes (how a design was built).
- **Identity:** milestones are stored per owner and **per creation id**, so two identical designs
  have separate galleries.
- **Limits:** 12 per design, and about 400,000 characters of stored JSON per owner. When either
  limit is reached the screen says so and nothing is overwritten.
- **Storage (actual):** on this device only. Not synced to the account, not in the data export.
- **Compare:** pick any two milestones to see them side by side, ordered by date, with a list of
  actual model changes by layer id: added, removed, moved, recoloured, turned, resized, motif
  changed, visibility, background and symmetry. There's no judgement of quality or meaning.
- **Open as a new copy:** a deep copy goes to the Creator as an unsaved design
  (`source: 'milestone'`). The current design, the milestone and the saved creation are never
  overwritten.
- **Delete:** deleting a milestone always asks first.
- **Parent deleted:** the milestones stay on the device and the gallery says the design was
  deleted. They can still be opened as copies, or deleted all at once with a confirmation.
  Deleting a creation in the Creator doesn't delete its milestones automatically.
- **Account change:** each owner sees only their own milestones.

## Tests

- `milestones.test.ts`:
  - identity (identical designs with different ids are separate);
  - deep copies (later edits and a restored copy's edits leave the milestone unchanged);
  - the per-design and total-size limits;
  - label cleaning;
  - deletion;
  - failed writes;
  - serialized delayed writes;
  - ownership;
  - the model-change comparison.
- `e2e/tests/oymo-milestones.spec.ts`:
  - saved design → milestone → edit → milestone → gallery → compare → open the earlier one as a
    copy, with no creation writes and the milestone unchanged → confirmed delete;
  - a deleted parent, and another owner hidden (RU).

Device checks: PENDING.
