# Oymo canvas: zoom, pan and precise positioning

Zoom and pan are a view of the artwork, never part of it. Layers keep their points in the fixed 0–300 artwork space (`CANVAS_SIZE`). Symmetry, Undo, recipes, saving, sharing and exports all read those points, and every screen point is mapped back through `screenToArtwork` before it reaches a layer (`src/features/culture/oymo/canvas/canvasViewport.ts`).

```
screen  = (artwork - c) * zoom + c + pan      c = 150 (React Native's centred transform origin)
artwork = (screen - c - pan) / zoom + c
```

- **Zoom.** Steps of 1×, 1.5×, 2× and 3×, through zoom in, zoom out and reset. The level is shown ("200%") and announced to screen readers. A pinch zooms around the pinch point; the buttons zoom around the centre. Both keep the point under the focus in place.
- **Pan.** Clamped so the artwork always covers the frame. At 1× there is nothing to pan, but a drag is still swallowed, so it never places a motif.
- **Session only.** The viewport is component state, reset with Clear or when a saved design opens. It is never stored, saved or exported. Share images and other screens use the plain fixed canvas, which is unchanged.

## Gestures

The canvas reuses `react-native-gesture-handler`, the same set-up as the Explore map:

- A **tap** (movement ≤ `TAP_SLOP` 10 px) on a drawn motif, or any of its mirrored copies, selects the topmost layer there. On empty canvas it places the motif at the artwork point, clamped to the integer grid.
- A **drag** (≥ `PAN_THRESHOLD` 12 px) pans; a **pinch** zooms.
- The gestures are combined as `Race(Simultaneous(pinch, pan), tap)`. Because the tap fails before a pan can start, a pan can never place a motif. `Exclusive` was tried first, but the tap then waits for the pinch to fail, which never happens with a mouse.
- **Motif buttons** remain for keyboards and screen readers (`pointerEvents="none"`, so pointer taps go through the hit-test). Selecting is also possible from the Layers panel.
- **Selection handles** are drawn unscaled over the zoomed artwork: a 2 px dashed outline at every zoom, sized at `handleSize()` and never smaller than 44 px.

## Precise positioning

When a layer is selected, **Position** shows X and Y fields and four nudge buttons, with a step of 1 or 10 points:

- Values are artwork units (0–300), the same numbers a tap produces at any zoom (tested).
- `moveLayerTo` / `moveLayerBy` move the layer's original point; the mirrors follow from the symmetry. Rotation, scale, colour and custom motif geometry are untouched.
- Consecutive moves of the same layer are one Undo step and one recipe step. The new recipe label `move` ("Moved a motif") exists in KG, RU and EN.
- Compatibility: a recipe that contains a move step can't be read by an older app version, which rejects unknown labels. Recipes are local to the device, so this only affects downgrades.

## Accessibility fixes made here

- **Delete label contrast.** The TransformToolbar "Delete" label measured 3.23:1. A new `colors.dangerText` (#A83232, ≥ 4.89:1 on every cream) is now used for destructive text and icons across the app (11 places).
- **Step selector.** It uses real radio controls; the earlier chip version used `aria-selected` on buttons, which axe flags.

## Tests

- **Unit:** `canvas/canvasViewport.test.ts` covers:
  - exact screen↔artwork round trips at several zoom/pan positions;
  - zoom keeps the focus point in place;
  - zoom steps, limits and pan clamping;
  - tap slop < pan threshold, plus the gesture wiring;
  - hit-testing across mirrored copies and visibility;
  - numeric moves agree with taps, moves are clamped, and geometry is preserved;
  - recipe labels in all languages, and the viewport is session-only.
- **E2E:** `e2e/tests/canvas-zoom.spec.ts` covers:
  - a 2× tap places at artwork (105, 105) with four mirrored copies;
  - a −80 px drag pans and adds nothing;
  - a tap on the panned copy selects the layer (fields read 105/105);
  - a nudge of +10 and typing Y = 40;
  - two Undos (the placement, then the whole run of moves);
  - reset to 100%;
  - axe passes;
  - at 1×, KG: a tap places at (40, 250).
- **Screenshot** reviewed: `e2e/.results/canvas-zoom.png`.

## Native gesture checks: PENDING (needs a physical iOS and Android device)

1. A pinch zooms around the fingers; zoom stays between 1× and 3×.
2. A one-finger drag pans with no placement, including slow drags that start on a motif.
3. A quick tap places; a tap on a motif selects it, at 1× and at 3×.
4. Two-finger pan plus pinch at the same time.
5. Scrolling the Creator page vertically still works when the drag starts outside the canvas. Inside the canvas, a drag pans the canvas, not the page.
6. VoiceOver / TalkBack: motif buttons are announced and selectable; the zoom level is announced; the Position fields open the number pad.
