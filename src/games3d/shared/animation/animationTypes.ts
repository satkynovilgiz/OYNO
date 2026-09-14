/** Shared animation-state vocabulary for GLB-driven characters/horses
 * (CharacterLoader/HorseLoader). A manifest entry maps these to whatever
 * clip names its own GLB actually ships - callers never reference a raw
 * clip name themselves, so re-exporting a model with renamed clips only
 * requires updating its manifest entry, not every call site. */
export type AnimationStateId = 'Idle' | 'Walk' | 'Run' | 'Gallop' | 'Aim' | 'Shoot' | 'Ride';
