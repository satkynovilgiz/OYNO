import AsyncStorage from '@react-native-async-storage/async-storage';

function storageKey(gameId: string) {
  return `games3d.bestScore.${gameId}`;
}

/** Per-game personal best, stored locally (same fail-soft AsyncStorage
 * pattern as `tutorialStorage.ts` - no Supabase sync yet, matching this
 * being a client-only convenience rather than a leaderboard/anti-cheat
 * concern). Returns `null` on first play or a storage read failure. */
export async function getBestScore(gameId: string): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(gameId));
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/** Writes `score` as the new best only if it beats the stored one (or none
 * exists yet). Returns whether this call actually set a new best, so the
 * caller can show a "new personal best!" moment exactly once. */
export async function setBestScoreIfHigher(gameId: string, score: number): Promise<boolean> {
  try {
    const previous = await getBestScore(gameId);
    if (previous !== null && score <= previous) return false;
    await AsyncStorage.setItem(storageKey(gameId), String(score));
    return true;
  } catch {
    return false;
  }
}
