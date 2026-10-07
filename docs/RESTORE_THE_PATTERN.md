# Restore the Pattern (2026-10-07)

Route `/culture/oymo/restore`, entered from the Oymo Creator.
Code: `src/features/culture/oymo/restore/`. It reuses the Creator's motifs
and their SVG rendering, its colour swatches, its 300-unit canvas and its
layer model, plus a new in-memory handoff (`src/services/culture/oymoHandoff.ts`).

- **Board:** 3×3 slots. A piece is a motif in a named colour, turned in 90°
  steps. You place pieces by tapping: tap a piece, then tap a slot. Dragging
  isn't needed. Turn, Back to tray, Undo (one step), Reset and Hint (places
  one missing piece correctly, and the count is shown) are all labelled
  buttons.
- **Six authored puzzles,** getting harder: 2 → 9 pieces, no turns → every
  turn, two colours, and the given centre pieces stop by the end.
  `restore.test.ts` solves every puzzle using only player actions.
- **Solution:** each slot must hold the target's motif and colour in a
  rotation that LOOKS the same. That depends on the motif's rotation order,
  read off its SVG geometry: Tört kulak 4 (any turn), Umai oyumu 2 (0 = 180
  and 90 = 270), every other motif 1. Identical pieces in swapped places are
  the same solution. The geometry claims are checked against the SVG source
  by a test.
- **Content:** motif names are the Creator's existing ones. Descriptions
  are shown only for motifs whose article text is reviewed in all three
  languages (Kochkor müyüz, Umai Ene, Kaz moyun). The others show just
  their name and a link to their existing article. No meaning is written
  here.
- **Saved artworks:** the puzzle never reads, saves or changes saved Oymo
  creations. "Open in Creator" hands over a deep copy that the Creator
  opens as a new, unsaved design (symmetry off) with a note saying it
  isn't saved. Saving it creates a new creation.
- **Offline,** KG/RU/EN. Every slot and piece is labelled with motif,
  colour name and rotation, so colour or gesture is never the only cue.
  There's no motion.

Device checks (PENDING): tap accuracy on the 92-pt slots on a small phone;
VoiceOver / TalkBack read the target grid, the board and the tray in
order; after "Open in Creator", saving creates a new creation and leaves
earlier ones untouched (signed in).
