import * as fs from 'fs';
import * as path from 'path';

import { endPan, endPinch, gestureIdle, movePan, movePinch, openGesture, startPan, startPinch, TAP_QUIET_MS, tapAllowed, type GestureSession } from './canvasGesture';
import { artworkToScreen, clampViewport, IDENTITY, MAX_ZOOM, screenToArtwork, TAP_SLOP, type Viewport } from './canvasViewport';

const SIZE = 300;
const close = (a: { x: number; y: number }, b: { x: number; y: number }, digits = 6) => {
  expect(a.x).toBeCloseTo(b.x, digits);
  expect(a.y).toBeCloseTo(b.y, digits);
};
const view = (zoom: number, panX = 0, panY = 0): Viewport => clampViewport({ zoom, panX, panY }, SIZE);

/**
 * A two-finger gesture: the fingers' centre moves from `from` by `move`
 * while the spread scales by `scale`. Pan (centre translation) and pinch
 * (scale, focal = current centre) events are emitted in the given order per
 * frame - as RNGH may deliver them in either order.
 */
function twoFinger(start: Viewport, from: { x: number; y: number }, move: { x: number; y: number }, scale: number, frames: number, order: 'pan-first' | 'pinch-first' | 'alternate'): GestureSession {
  let s = startPinch(startPan(openGesture(start, SIZE)), from);
  for (let i = 1; i <= frames; i++) {
    const t = { x: (move.x * i) / frames, y: (move.y * i) / frames };
    const k = 1 + ((scale - 1) * i) / frames;
    const focal = { x: from.x + t.x, y: from.y + t.y };
    const panFirst = order === 'pan-first' || (order === 'alternate' && i % 2 === 0);
    if (panFirst) s = movePinch(movePan(s, t, SIZE), k, focal, SIZE);
    else s = movePan(movePinch(s, k, focal, SIZE), t, SIZE);
  }
  return s;
}

describe('interleaved pan / pinch - one composed transform', () => {
  it('a pan update after a pinch keeps the new zoom (the old snapshot bug restored the start zoom)', () => {
    let s = startPinch(startPan(openGesture(IDENTITY, SIZE)), { x: 150, y: 150 });
    s = movePinch(s, 2, { x: 150, y: 150 }, SIZE);
    expect(s.viewport.zoom).toBe(2);
    s = movePan(s, { x: -20, y: 10 }, SIZE);
    expect(s.viewport.zoom).toBe(2);
    expect(s.viewport.panX).toBeCloseTo(-20);
    expect(s.viewport.panY).toBeCloseTo(10);
  });

  it('a pinch update after a pan keeps the pan movement (the old bug dropped it)', () => {
    let s = startPinch(startPan(openGesture(view(2), SIZE)), { x: 150, y: 150 });
    s = movePan(s, { x: 40, y: -30 }, SIZE);
    s = movePinch(s, 1.25, { x: 190, y: 120 }, SIZE); // fingers' centre moved with the pan
    expect(s.viewport.zoom).toBeCloseTo(2.5);
    // The artwork centre that was under the fingers is still under them.
    close(artworkToScreen({ x: 150, y: 150 }, s.viewport, SIZE), { x: 190, y: 120 });
  });

  it('the artwork point under the fingers follows them exactly, whatever order the events arrive in', () => {
    const start = view(1.5, 20, -10);
    const from = { x: 120, y: 170 };
    const anchor = screenToArtwork(from, start, SIZE);
    const results = (['pan-first', 'pinch-first', 'alternate'] as const).map((order) => twoFinger(start, from, { x: 30, y: -25 }, 1.6, 12, order));
    for (const s of results) {
      expect(s.viewport.zoom).toBeCloseTo(2.4);
      close(artworkToScreen(anchor, s.viewport, SIZE), { x: 150, y: 145 });
    }
    // Order-independent: every frame recomputes from the latest values of both gestures.
    close({ x: results[0].viewport.panX, y: results[0].viewport.panY }, { x: results[1].viewport.panX, y: results[1].viewport.panY }, 9);
    close({ x: results[0].viewport.panX, y: results[0].viewport.panY }, { x: results[2].viewport.panX, y: results[2].viewport.panY }, 9);
  });

  it('repeated identical events are idempotent (no drift from re-delivered updates)', () => {
    let s = startPinch(startPan(openGesture(view(2), SIZE)), { x: 100, y: 100 });
    s = movePinch(movePan(s, { x: 10, y: 5 }, SIZE), 1.2, { x: 110, y: 105 }, SIZE);
    const once = s.viewport;
    for (let i = 0; i < 5; i++) s = movePinch(movePan(s, { x: 10, y: 5 }, SIZE), 1.2, { x: 110, y: 105 }, SIZE);
    expect(s.viewport).toEqual(once);
  });

  it('a pinch starting in the middle of a pan continues from the panned view (no jump)', () => {
    let s = startPan(openGesture(view(2), SIZE));
    s = movePan(s, { x: -30, y: 0 }, SIZE);
    const panned = s.viewport;
    s = startPinch(s, { x: 150, y: 150 });
    expect(s.viewport).toEqual(panned);
    s = movePan(s, { x: -30, y: 0 }, SIZE); // the pan's raw translation has not changed yet
    expect(s.viewport).toEqual(panned);
    s = movePinch(s, 1.5, { x: 150, y: 150 }, SIZE);
    expect(s.viewport.zoom).toBeCloseTo(3);
    close(artworkToScreen(screenToArtwork({ x: 150, y: 150 }, panned, SIZE), s.viewport, SIZE), { x: 150, y: 150 });
  });

  it('the pan carries on after the pinch ends, and vice versa, without a jump', () => {
    let s = twoFinger(view(1.5), { x: 150, y: 150 }, { x: 20, y: 20 }, 1.5, 4, 'alternate');
    s = endPinch(s);
    const afterPinch = s.viewport;
    s = movePan(s, { x: 20, y: 20 }, SIZE); // same raw translation: no change
    expect(s.viewport).toEqual(afterPinch);
    s = movePan(s, { x: 30, y: 20 }, SIZE); // 10 more px to the right
    expect(s.viewport.zoom).toBeCloseTo(afterPinch.zoom);
    expect(s.viewport.panX).toBeCloseTo(afterPinch.panX + 10);

    let t = twoFinger(view(1.5), { x: 150, y: 150 }, { x: 0, y: 0 }, 1.2, 3, 'pan-first');
    t = endPan(t);
    const afterPan = t.viewport;
    t = movePinch(t, 1.2, { x: 150, y: 150 }, SIZE);
    expect(t.viewport).toEqual(afterPan);
    expect(gestureIdle(endPinch(t))).toBe(true);
  });

  it('clamping: zoom stays within limits, and movement past an edge is not owed back', () => {
    let s = startPinch(openGesture(view(2), SIZE), { x: 150, y: 150 });
    s = movePinch(s, 3, { x: 150, y: 150 }, SIZE); // wants 6x
    expect(s.viewport.zoom).toBe(MAX_ZOOM);
    s = movePinch(s, 2.7, { x: 150, y: 150 }, SIZE); // pinch back 10%: zooms out immediately
    expect(s.viewport.zoom).toBeCloseTo(2.7);

    let p = startPan(openGesture(view(2), SIZE));
    p = movePan(p, { x: 400, y: 0 }, SIZE); // far past the edge (limit 150)
    expect(p.viewport.panX).toBe(150);
    p = movePan(p, { x: 390, y: 0 }, SIZE); // 10 px back: moves at once
    expect(p.viewport.panX).toBeCloseTo(140);
  });

  it('degenerate pinch scales (0 / NaN while a finger lifts) are ignored', () => {
    let s = startPinch(openGesture(view(2), SIZE), { x: 150, y: 150 });
    s = movePinch(s, 1.2, { x: 150, y: 150 }, SIZE);
    const before = s.viewport;
    expect(movePinch(s, 0, { x: 150, y: 150 }, SIZE).viewport).toEqual(before);
    expect(movePinch(s, Number.NaN, { x: 150, y: 150 }, SIZE).viewport).toEqual(before);
  });

  it('updates from a gesture that never started change nothing', () => {
    const s = openGesture(view(2, 10, 10), SIZE);
    expect(movePan(s, { x: 50, y: 50 }, SIZE)).toBe(s);
    expect(movePinch(s, 2, { x: 0, y: 0 }, SIZE)).toBe(s);
  });
});

describe('gestures never place motifs accidentally', () => {
  it('no tap during a session or in the quiet window after one', () => {
    expect(tapAllowed(true, null, 1000)).toBe(false);
    expect(tapAllowed(false, 1000, 1000 + TAP_QUIET_MS - 1)).toBe(false);
    expect(tapAllowed(false, 1000, 1000 + TAP_QUIET_MS)).toBe(true);
    expect(tapAllowed(false, null, 0)).toBe(true);
    expect(TAP_SLOP).toBeLessThan(12);
  });

  it('the canvas routes pan and pinch through the one session and guards taps', () => {
    const canvas = fs.readFileSync(path.join(__dirname, '../components/OymoCanvas.tsx'), 'utf8');
    expect(canvas).toMatch(/Gesture\.Race\(Gesture\.Simultaneous\(pinch, pan\), tap\)/);
    expect(canvas).toMatch(/tapAllowed\(/);
    for (const call of ['startPan', 'movePan', 'endPan', 'startPinch', 'movePinch', 'endPinch']) expect(canvas).toContain(call);
    // No per-gesture viewport snapshot any more.
    expect(canvas).not.toMatch(/start\.current/);
  });
});
