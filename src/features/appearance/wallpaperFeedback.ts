import type { SaveResult } from '@/services/wallpaper/wallpaperActions';

/** What the wallpaper screen shows after a save attempt: 'saved' only when
 * the image really reached Photos (or the browser download); anything else
 * is 'failed' with its own honest message. */
export function wallpaperSaveFeedback(result: SaveResult): { state: 'saved' | 'failed'; toast: boolean } {
  if (result === 'saved' || result === 'downloaded') return { state: 'saved', toast: true };
  return { state: 'failed', toast: false };
}
