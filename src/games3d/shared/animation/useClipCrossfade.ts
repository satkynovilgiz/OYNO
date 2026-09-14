import { useEffect, useRef, type MutableRefObject } from 'react';
import type * as THREE from 'three';

import type { AnimationStateId } from './animationTypes';

const FADE_SECONDS = 0.2;

type ClipActions = Record<string, THREE.AnimationAction | null | undefined>;

/** Crossfades to `desiredState`'s clip if (and only if) it differs from
 * `currentClipNameRef`'s last value - safe to call every frame from a
 * `useFrame` loop (for a ref-driven gait that changes without a
 * re-render, e.g. HorseLoader) as well as once per prop change (see
 * `useClipCrossfade` below, for CharacterLoader). The no-change path is
 * just a ref comparison, so calling this unconditionally every frame costs
 * nothing extra. */
export function applyClipCrossfade(
  actions: ClipActions,
  clipNames: Partial<Record<AnimationStateId, string>>,
  desiredState: AnimationStateId,
  currentClipNameRef: MutableRefObject<string | null>,
) {
  const nextClipName = clipNames[desiredState];
  if (!nextClipName || nextClipName === currentClipNameRef.current) return;

  const nextAction = actions[nextClipName];
  if (!nextAction) return;

  const previousClipName = currentClipNameRef.current;
  const previousAction = previousClipName ? actions[previousClipName] : null;

  nextAction.reset().fadeIn(FADE_SECONDS).play();
  previousAction?.fadeOut(FADE_SECONDS);
  currentClipNameRef.current = nextClipName;
}

/** Prop-driven convenience wrapper around `applyClipCrossfade` for a
 * desired state that changes at normal React cadence (a state/prop value),
 * not a per-frame ref - see HorseLoader.tsx's `GltfHorse` for the
 * per-frame-ref version, which calls `applyClipCrossfade` directly from
 * its own `useFrame` instead of this hook. */
export function useClipCrossfade(
  actions: ClipActions,
  clipNames: Partial<Record<AnimationStateId, string>>,
  desiredState: AnimationStateId,
) {
  const currentClipName = useRef<string | null>(null);

  useEffect(() => {
    applyClipCrossfade(actions, clipNames, desiredState, currentClipName);
  }, [actions, clipNames, desiredState]);
}
