import type { ImageSourcePropType } from 'react-native';

/** The 5 games in scope for the 3D-games proof-of-concept phase. Do not add
 * ids here for games that haven't started their own Phase yet - the registry
 * entry existing is what makes a game selectable from the 3D Game Lab. */
export type Game3DId = 'jaa_atuu' | 'ordo' | 'chuko' | 'kyz_kuumai' | 'kok_boru';

/** VISUAL_ONLY = scene renders but no real gameplay loop yet.
 * PARTIAL = gameplay loop exists but is missing a system (e.g. no AI, no result screen).
 * PLAYABLE = full Loading -> Tutorial -> Gameplay -> Result -> Replay/Exit loop, no crashes.
 * COMING_SOON = not started. */
export type Game3DStatus = 'COMING_SOON' | 'VISUAL_ONLY' | 'PARTIAL' | 'PLAYABLE';

export type Game3DOrientation = 'portrait' | 'landscape';

/** Canonical phase set every 3D game's controller should use instead of ad
 * hoc booleans (isPlaying/isPaused/didStart/...). A given game may not need
 * every phase (Jaa Atuu's shot resolves synchronously, so it has no
 * separate settling phase) but should draw from this set rather than invent
 * unrelated names, so PauseMenu/ResultScreen/HUD wiring reads the same way
 * across every game.
 *
 * LOADING - async assets (models/audio) loading, before anything is shown.
 * INTRO   - brief (~2-4s) title-card beat, skippable.
 * TUTORIAL- short "how to play" overlay, skippable, shown once per session.
 * READY   - waiting for the player's next input (nocked arrow, piece in hand, etc).
 * PLAYING - an action is resolving (arrow in flight, piece sliding, horse racing).
 * PAUSED  - explicit user pause or app backgrounded; timers/AI/physics frozen.
 * RESULT  - round/match over, showing the result screen. */
export type GamePhase = 'LOADING' | 'INTRO' | 'TUTORIAL' | 'READY' | 'PLAYING' | 'PAUSED' | 'RESULT';

export type Game3DRegistryEntry = {
  id: Game3DId;
  titleKey: string;
  route: `/games/${string}` | null;
  status: Game3DStatus;
  orientation: Game3DOrientation;
  thumbnail: ImageSourcePropType | null;
  difficulty: 'easy' | 'medium' | 'hard';
};

/** Shared shape for a game's post-match summary. Each game fills in its own
 * subset via `stats`; the result screen renders whatever keys are present
 * rather than assuming every game has the same stat set (Section 22). */
export type Game3DResult = {
  gameId: Game3DId;
  stats: Record<string, string | number>;
  completedAt: number;
};
