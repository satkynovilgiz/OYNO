import AsyncStorage from '@react-native-async-storage/async-storage';

/** Section 21: "After first completion: allow SKIP TUTORIAL. Store local
 * tutorial-completed state. Do not force full tutorial every time." Shared
 * across every 3D game - keyed by game id so each game tracks its own
 * first-play state independently. */
function storageKey(gameId: string) {
  return `games3d.tutorialSeen.${gameId}`;
}

export async function hasSeenTutorial(gameId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(storageKey(gameId))) === '1';
  } catch {
    // Storage unavailable (e.g. private browsing on web) - default to
    // showing the tutorial rather than crashing.
    return false;
  }
}

export async function markTutorialSeen(gameId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(gameId), '1');
  } catch {
    // Non-fatal - worst case the tutorial shows again next time.
  }
}
