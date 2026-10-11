# Create Together

`/culture/oymo/together` (entry in the Oymo Creator). Two people take turns
on one shared Oymo design on one device.

## Rules (`togetherCreateModel.ts`)

- **Setup:** optional names (on this screen only); turns 2 / 4 / 6, or free
  creation (finish any time).
- **A turn:**
  - says whose turn it is ("Aida's turn · turn 1 of 2");
  - edits use the Creator's own `addLayer` / `removeLayer` on its canvas,
    with its motifs, colours and symmetry;
  - a list of layers with remove buttons is the accessible alternative to
    the canvas.
- **Pass the device:** the design is kept and nothing can change. The next
  player explicitly taps "I'm … - start my turn". Untimed.
- **Undo:** only within the current turn. Its floor is the design as the
  turn began, so it can never remove the other player's previous turn.
- **Clear the whole design:** asks first, and can be undone within the same
  turn.
- **Layer limit:** the Creator's `MAX_OYMO_LAYERS` (200). A placement at the
  limit changes nothing and adds no undo step; the screen says so.
- **Finish:** a preview and an optional design name. Then **Open in the
  Creator**: an independent unsaved copy (the handoff deep-copies), with the
  name pre-filled in the Creator's Save dialog.
  - Player names are never added unless typed as the design's name.
  - The screen explains that saving happens in the Creator with the
    signed-in account; a guest's design stays unsaved.
- No scores, no quality claims, nothing stored by this activity.

## Fix found on the way

The Creator canvas container had `role="image"` while containing tappable
motif buttons (axe: nested-interactive, serious). It is now a labelled
`group`. The existing Oymo e2e tests pass with the change.

## Tests

- `together/createTogether.test.ts`:
  - turns: pass keeps the design; nothing changes before the next player
    starts; the turn limit leads to finish; free creation; new session;
  - Undo boundary across turns (including a removed layer);
  - reset needs confirmation and is undoable;
  - the layer limit;
  - the final design is an exact, independent copy with no names.
- `e2e/tests/create-together.spec.ts`: A places 2 -> axe -> pass -> B
  starts (A's layers kept; Undo can't reach them) -> reset confirmation ->
  finish -> name -> Creator copy.
