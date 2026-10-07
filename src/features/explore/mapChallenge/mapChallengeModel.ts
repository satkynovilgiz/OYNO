import { seededRng, shuffle, type Rng } from '@/features/detective/detectiveModel';

import { MAP_QUESTIONS, markersFor, type MapMarker, type MapQuestion } from './mapChallengeData';

/**
 * Map Challenge rules (pure; no timer): five different questions, one
 * point per correct pick, every answer revealed with its explanation.
 * Playing is NOT visiting: nothing here touches visits or the passport.
 */
export const SESSION_LENGTH = 5;

/** A tap counts for the nearest marker of the current layer within this
 * distance (percent of the map's width, so it is the same on every screen). */
export const HIT_RADIUS_PERCENT = 6;

/**
 * Which marker a tap selects. Coordinates are percentages of the map art;
 * the art keeps its aspect, so y is scaled by the aspect to measure in the
 * same units as x. null = nothing close enough (the tap does nothing).
 */
export function markerAt(point: { xPercent: number; yPercent: number }, markers: readonly MapMarker[], aspect: number, radius = HIT_RADIUS_PERCENT): MapMarker | null {
  let best: { marker: MapMarker; distance: number } | null = null;
  for (const marker of markers) {
    const dx = point.xPercent - marker.at.xPercent;
    const dy = (point.yPercent - marker.at.yPercent) / aspect;
    const distance = Math.hypot(dx, dy);
    if (distance <= radius && (!best || distance < best.distance)) best = { marker, distance };
  }
  return best?.marker ?? null;
}

/** Pixel tap on a map drawn at width x height -> percent coordinates. */
export function toPercent(x: number, y: number, width: number, height: number) {
  return { xPercent: (x / width) * 100, yPercent: (y / height) * 100 };
}

export function buildMapSession(rng: Rng = seededRng(Date.now()), options: { onlyIds?: readonly string[] } = {}): MapQuestion[] {
  const pool = options.onlyIds ? MAP_QUESTIONS.filter((question) => options.onlyIds!.includes(question.id)) : MAP_QUESTIONS;
  return shuffle(pool, rng).slice(0, Math.min(SESSION_LENGTH, pool.length));
}

export type MapAnswer = { questionId: string; chosenId: string; correct: boolean };

export type MapSession = { questions: MapQuestion[]; index: number; answers: MapAnswer[]; showingAnswer: boolean };

export const startMapSession = (questions: MapQuestion[]): MapSession => ({ questions, index: 0, answers: [], showingAnswer: false });

export type MapAction = { type: 'choose'; markerId: string } | { type: 'next' };

/** Out-of-turn input (a second tap, a marker of the other layer) changes nothing. */
export function mapReducer(state: MapSession, action: MapAction): MapSession {
  const question = state.questions[state.index];
  if (!question) return state;
  if (action.type === 'choose') {
    if (state.showingAnswer || !markersFor(question.layer).some((marker) => marker.id === action.markerId)) return state;
    return { ...state, answers: [...state.answers, { questionId: question.id, chosenId: action.markerId, correct: action.markerId === question.targetId }], showingAnswer: true };
  }
  if (!state.showingAnswer) return state;
  return { ...state, index: state.index + 1, showingAnswer: false };
}

export const mapFinished = (state: MapSession) => state.questions.length > 0 && state.index >= state.questions.length;

export function mapSummary(state: MapSession) {
  return {
    correct: state.answers.filter((answer) => answer.correct).length,
    total: state.questions.length,
    mistakes: state.answers.filter((answer) => !answer.correct),
  };
}
