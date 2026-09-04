import type { Game3DRegistryEntry } from './gameTypes';

/** Single source of truth for what the 3D Game Lab (and, later, the
 * production Games hub) can show. A game becomes selectable in the Lab the
 * moment it has an entry here - `route: null` disables the Play button
 * instead of navigating into a broken screen (Section 95). */
export const game3DRegistry: Game3DRegistryEntry[] = [
  {
    id: 'jaa_atuu',
    titleKey: 'games3d.titles.jaaAtuu',
    route: '/games/jaa-atuu',
    // Full loop (aim/draw/shoot/score/result/replay) is implemented and
    // typechecks/unit-tests pass, but per Section 80/81 this stays PARTIAL
    // until it's actually been run on a real device without crashing -
    // flip to PLAYABLE only after that verification.
    status: 'PARTIAL',
    orientation: 'landscape',
    thumbnail: null,
    difficulty: 'easy',
  },
  {
    id: 'ordo',
    titleKey: 'games3d.titles.ordo',
    route: '/games/ordo',
    // Full loop implemented (throw/settle/score/AI turn/khan capture/
    // result/replay), typechecked and unit-tested, but not yet run on a
    // real device - see Section 80/81 (don't claim PLAYABLE unverified).
    status: 'PARTIAL',
    orientation: 'landscape',
    thumbnail: null,
    difficulty: 'medium',
  },
  {
    id: 'chuko',
    titleKey: 'games3d.titles.chuko',
    route: '/games/chuko',
    status: 'PARTIAL',
    orientation: 'landscape',
    thumbnail: null,
    difficulty: 'easy',
  },
  {
    id: 'kyz_kuumai',
    titleKey: 'games3d.titles.kyzKuumai',
    route: '/games/kyz-kuumai',
    status: 'PARTIAL',
    orientation: 'landscape',
    thumbnail: null,
    difficulty: 'medium',
  },
  {
    id: 'kok_boru',
    titleKey: 'games3d.titles.kokBoru',
    route: '/games/kok-boru',
    // Phase A only (Section "KOK BORU — PHASED DEVELOPMENT"): 1 player, 1
    // horse, pick up/carry/score. No AI opponent/stealing/match rules yet.
    status: 'PARTIAL',
    orientation: 'landscape',
    thumbnail: null,
    difficulty: 'hard',
  },
];

export function getGame3DEntry(id: Game3DRegistryEntry['id']): Game3DRegistryEntry | undefined {
  return game3DRegistry.find((entry) => entry.id === id);
}
