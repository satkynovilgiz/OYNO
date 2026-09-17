import AsyncStorage from '@react-native-async-storage/async-storage';

/** Tracks whether a player has already met a given game's host character
 * intro (see GameIntroScreen/guideCharacterGating.ts) - same pattern as
 * games3d/core/tutorialStorage.ts, kept separate since this gates the
 * 2D host-character dialogue, not the 3D games' own tutorial overlay. */
function storageKey(gameId: string) {
  return `oyno.gameIntroSeen.${gameId}`;
}

export async function hasSeenGameIntro(gameId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(storageKey(gameId))) === '1';
  } catch {
    // Storage unavailable - default to showing the intro rather than crashing.
    return false;
  }
}

export async function markGameIntroSeen(gameId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(gameId), '1');
  } catch {
    // Non-fatal - worst case the intro shows again next time.
  }
}
