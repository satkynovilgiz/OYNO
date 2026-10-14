# Tablet and wide-window layouts

- **One breakpoint helper.** `src/hooks/useIsTablet.ts` (`useIsTablet`, `useLayoutClass`, `layoutClassFor`) defines phone < 768 ≤ tablet < 1200 ≤ wide. 768 was the existing tablet breakpoint, already used by the Creator, Boz Üy and Shyrdak screens.
- **Bounded columns.** `bounded(maxWidth)` in `theme/ui.ts` sets `width: 100%`, a `maxWidth` and centring. Phones are narrower than every limit, so small-screen layouts are unchanged.

| Width token | Used by |
| --- | --- |
| `layout.maxContentWidth` 720 | Article and material reading text (plus the plain header), the Explain screens, scrapbook list and editor, My Questions, journal editor and detail, Create hub, presentation preview, Focus exit bar |
| `layout.maxListWidth` 960 | Home (the whole scroll column; hero card heights come from the column width, not the window, capped at 480), My OYNO Shelf |
| `layout.maxWorkspaceWidth` 1200 | Oymo Creator |

## Per screen

- **Articles.** The text is at most 720 wide and centred. The hero keeps its aspect ratio but is capped at 460 high, so on a wide window it stays a hero instead of filling the screen.
- **Creator.**
  - From 768 up, the tools (motifs, colours, symmetry, layers) sit in a column beside the canvas. On phones they appear below it, behind tabs.
  - All design, history, selection, zoom and tab state lives in the screen, so rotating or resizing only changes the arrangement. It never resets the design, the selection or Undo (E2E: phone → landscape tablet → phone).
  - The Position panel is capped at 480.
- **Shelf.** One column on phones and two on tablets: cards wrap at 320 pt and are never wider than half the list. It is not a two-pane layout, because each item opens its own full screen (an exhibition, board, capsule or design) and gains nothing from a side-by-side detail pane. No screen in this pass uses two panes for that reason.
- **Record editors.** Scrapbook, questions and journal editors keep a readable 720 width. Unsaved edits live in component or draft state, which a resize never remounts (E2E: a scrapbook title typed on a tablet survives landscape and phone sizes).
- **Large text and keyboard.** Columns wrap rather than truncate: tiles and shortcuts use `flexBasis` and grow in height. Keyboard focus and Enter work at tablet size (E2E: a Home shortcut opened from the keyboard).

## Tests

`e2e/tests/responsive-layouts.spec.ts`, at phone 390 × 844, tablet 820 × 1180, landscape 1180 × 820 and wide 1440 × 900, covers:

- the article reading width (≤ 720) at all four sizes, with no overflow;
- the Creator layout and state across rotation;
- the Shelf as one column, then two;
- the Home column centred and ≤ 960 on wide;
- a record-editor edit surviving resizes;
- keyboard activation at tablet size;
- KG, RU and EN long text on Home, Shelf, Create and the shortcuts editor at tablet, landscape and wide: no overflow and no raw keys.

Screenshots reviewed: `e2e/.results/responsive-*.png`.

## Device checks: PENDING

- Real rotation on an iPad and an Android tablet: Creator, scrapbook editor, and article Focus view.
- iPad split view and slide-over widths (around 320–700).
- Hardware-keyboard tab order on an iPad.
