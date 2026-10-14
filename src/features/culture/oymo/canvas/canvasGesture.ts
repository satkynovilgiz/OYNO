import type { Point } from '@/services/culture/symmetry';

import { clampViewport, MAX_ZOOM, MIN_ZOOM, type Viewport } from './canvasViewport';

/**
 * One gesture session for the Oymo canvas: pan and pinch run at the same
 * time (Gesture.Simultaneous) but write ONE composed transform.
 *
 * The earlier version snapshotted the viewport separately at each gesture's
 * start and recomputed from that snapshot, so an interleaved update threw
 * the other gesture's change away (a pan update restored the start zoom, a
 * pinch update dropped the pan). Here each gesture only records its own
 * LATEST raw value (pan translation, pinch scale) and the viewport is always
 * recomputed from all of them together:
 *
 *   S = scale / scaleBase     T = translation - translationBase
 *   screen' = (screen_base - F) * S + F + T
 *
 * where `screen_base` is the view at the last rebase and F the pinch focal
 * point at that moment. The artwork point under F therefore stays under the
 * fingers (F + T is where the fingers' centre has moved to), whatever order
 * the two gestures' events arrive in.
 *
 * A rebase (base := current view, bases := current raw values) happens when
 * a gesture starts or ends, and whenever clamping engaged - so movement
 * past an edge or the zoom limit is not "owed" back before the view moves
 * again in the other direction.
 *
 * Pure and session-only: nothing here touches layers or is saved.
 */
export type GestureSession = {
  viewport: Viewport;
  base: Viewport;
  translationBase: Point;
  scaleBase: number;
  focal: Point;
  pan: Point | null;
  pinch: { scale: number; focal: Point } | null;
};

/** After a pan/pinch ends, a tap in this window is treated as part of it (a finger lifting late) and never places. */
export const TAP_QUIET_MS = 250;

const ORIGIN: Point = { x: 0, y: 0 };

export function openGesture(viewport: Viewport, size: number): GestureSession {
  return { viewport, base: viewport, translationBase: ORIGIN, scaleBase: 1, focal: { x: size / 2, y: size / 2 }, pan: null, pinch: null };
}

function rebase(session: GestureSession): GestureSession {
  return { ...session, base: session.viewport, translationBase: session.pan ?? ORIGIN, scaleBase: session.pinch?.scale ?? 1, focal: session.pinch?.focal ?? session.focal };
}

function compose(session: GestureSession, size: number): GestureSession {
  const { base, focal } = session;
  const translation = session.pan ? { x: session.pan.x - session.translationBase.x, y: session.pan.y - session.translationBase.y } : ORIGIN;
  const wanted = base.zoom * (session.pinch ? session.pinch.scale / session.scaleBase : 1);
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, wanted));
  const scale = zoom / base.zoom;
  const c = size / 2;
  const raw = { zoom, panX: (c + base.panX - focal.x) * scale + focal.x + translation.x - c, panY: (c + base.panY - focal.y) * scale + focal.y + translation.y - c };
  const viewport = clampViewport(raw, size);
  const clamped = zoom !== wanted || Math.abs(viewport.panX - raw.panX) > 1e-9 || Math.abs(viewport.panY - raw.panY) > 1e-9;
  const next = { ...session, viewport };
  return clamped ? rebase(next) : next;
}

export const startPan = (session: GestureSession): GestureSession => ({ ...rebase(session), pan: ORIGIN, translationBase: ORIGIN });
export const movePan = (session: GestureSession, translation: Point, size: number): GestureSession => (session.pan ? compose({ ...session, pan: translation }, size) : session);
export const endPan = (session: GestureSession): GestureSession => rebase({ ...rebase(session), pan: null });

export const startPinch = (session: GestureSession, focal: Point): GestureSession => rebase({ ...session, pinch: { scale: 1, focal } });
export function movePinch(session: GestureSession, scale: number, focal: Point, size: number): GestureSession {
  // A pinch event can report scale 0 / NaN as the second finger lifts - ignore it rather than collapse the zoom.
  if (!session.pinch || !Number.isFinite(scale) || scale <= 0) return session;
  return compose({ ...session, pinch: { scale, focal } }, size);
}
export const endPinch = (session: GestureSession): GestureSession => rebase({ ...rebase(session), pinch: null });

export const gestureIdle = (session: GestureSession) => session.pan === null && session.pinch === null;

/** May a tap place/select now? Never during a pan/pinch session or right after one. */
export const tapAllowed = (sessionActive: boolean, lastEndedAt: number | null, now: number) => !sessionActive && (lastEndedAt === null || now - lastEndedAt >= TAP_QUIET_MS);
