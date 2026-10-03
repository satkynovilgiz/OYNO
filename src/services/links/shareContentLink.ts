import { Share } from 'react-native';

import { track } from '@/services/analytics/analytics';

import { buildOYNODeepLink, linkShareText, type ContentLinkType } from './contentLinks';

export type ShareableLink = { type: ContentLinkType; id: string; title: string };

/** Shares "Title - OYNO" + the oyno:// link as text. Analytics get only the
 * content type and id (no sender, no account). */
export async function shareContentLink(link: ShareableLink): Promise<void> {
  const url = buildOYNODeepLink(link);
  if (!url) return;
  track('content_link_shared', { content_type: link.type, content_id: link.id });
  // Dismissing the sheet / no Web Share API is not an error (app convention).
  await Share.share({ message: linkShareText(link.title, url) }).catch(() => {});
}
