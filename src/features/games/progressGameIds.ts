/**
 * The 3D games record progress (`record_game_played`/`record_game_won`,
 * stored in `user_game_stats.game_id`) under their own snake_case
 * `GAME_ID` constants (src/games3d/games/<game>/<Game>Game.tsx), which
 * don't always match the kebab-case `GameListItem.id` the games list,
 * Profile and Journey key everything else by. Without this, a user's real
 * Kok Boru/Kyz Kuumai/Jaa Atuu plays never showed up anywhere that looked
 * them up by list id. Mapped here rather than renaming either side, since
 * the recorded ids already live in users' server-side stats.
 */
const PROGRESS_GAME_ID_BY_LIST_ID: Record<string, string> = {
  'kyz-kuumay': 'kyz_kuumai',
  'zhaa-atuu': 'jaa_atuu',
  'kok-boru': 'kok_boru',
};

export function progressGameIdFor(listGameId: string): string {
  return PROGRESS_GAME_ID_BY_LIST_ID[listGameId] ?? listGameId;
}
