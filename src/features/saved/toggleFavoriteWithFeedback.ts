import { showToast } from '@/components/ui/Toast';
import i18n from '@/i18n';
import { useFavoritesStore, type FavoriteContentType } from '@/store/useFavoritesStore';

/**
 * Save/unsave with a small confirmation. Local-first: the store flips the
 * heart synchronously and syncs in the background (unchanged sync path);
 * the toast is decided from the state *before* the tap so it appears
 * immediately rather than after the local write resolves.
 */
export function toggleFavoriteWithFeedback(contentType: FavoriteContentType, contentId: string): Promise<boolean> {
  const willFavorite = !useFavoritesStore.getState().isFavorite(contentType, contentId);
  showToast(i18n.t(willFavorite ? 'toast.saved' : 'toast.removed'), { haptic: willFavorite });
  return useFavoritesStore.getState().toggleFavorite(contentType, contentId);
}
