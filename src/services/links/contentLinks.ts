/**
 * Shareable Content Links 1.0 - ONE builder and ONE parser for links that
 * open public OYNO content in the app, using the app's REAL scheme from
 * app.json (`oyno://`). No website and no Universal/App Links are implied:
 * they are not configured for OYNO.
 *
 *   oyno://open/<type>/<id>
 *
 * The link carries only a content type and a public content id - never an
 * account id, progress, a sender or a tracking parameter. Incoming links
 * are untrusted: the type must be supported, the id well-formed and (in
 * the /open route) existing; anything else opens a safe fallback. A link
 * only NAVIGATES - it never plays audio, starts a game, submits a
 * challenge or changes progress.
 *
 * Friend Challenge links (`oyno://games/<route>?challengeMetric&target`)
 * stay separate on purpose: they carry their own validated parameters.
 */

export const OYNO_SCHEME = 'oyno';

export const CONTENT_LINK_TYPES = ['culture_item', 'culture_material', 'glossary', 'game', 'learning_path', 'komuz_track', 'calendar_event'] as const;
export type ContentLinkType = (typeof CONTENT_LINK_TYPES)[number];
export type ContentLink = { type: ContentLinkType; id: string };

/** Private things that can never be linked (v1): Journal, highlights and
 * notes, My Collections, listening bookmarks, study history. */
export const PRIVATE_TYPES = ['journal', 'highlight', 'note', 'my_collection', 'bookmark', 'listening', 'study'] as const;

/** Public content ids in OYNO: lowercase slugs. */
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,119}$/;

/** Game links open Game Detail (never the round itself). */
export const LINKABLE_GAMES = ['besh-tash', 'chuko', 'jaa-atuu', 'kok-boru', 'kyz-kuumai', 'ordo'] as const;

export function isContentLinkType(value: unknown): value is ContentLinkType {
  return typeof value === 'string' && (CONTENT_LINK_TYPES as readonly string[]).includes(value);
}

/** Well-formed (not yet "exists") link, or null. Never throws. */
export function parseContentLink(type: unknown, id: unknown): ContentLink | null {
  if (!isContentLinkType(type)) return null;
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return null;
  if (type === 'game' && !(LINKABLE_GAMES as readonly string[]).includes(id)) return null;
  return { type, id };
}

/** THE canonical link builder. Returns null for anything not linkable. */
export function buildOYNODeepLink(link: { type: string; id: string }): string | null {
  const parsed = parseContentLink(link.type, link.id);
  return parsed ? `${OYNO_SCHEME}://open/${parsed.type}/${parsed.id}` : null;
}

/** Parses a full `oyno://open/<type>/<id>[?...]` URL; query is ignored. */
export function parseOYNODeepLink(url: string): ContentLink | null {
  const match = /^oyno:\/\/open\/([^/?#]+)\/([^/?#]+)\/?(?:[?#].*)?$/.exec(url.trim());
  return match ? parseContentLink(match[1], match[2]) : null;
}

/** The app route a link opens - built here, never taken from the link. */
export function contentRoute(link: ContentLink): string {
  switch (link.type) {
    case 'culture_item':
      return `/culture/item/${link.id}`;
    case 'culture_material':
      return `/culture/material/${link.id}`;
    case 'glossary':
      return `/culture/glossary/${link.id}`;
    case 'game':
      return `/games/${link.id}`;
    case 'learning_path':
      return `/learn/${link.id}`;
    case 'calendar_event':
      return `/culture/calendar/${link.id}`;
    case 'komuz_track':
      // Selects the track; playback starts only when the person taps Play.
      return `/culture/komuz/listen?track=${link.id}`;
  }
}

/** Where an invalid or no-longer-existing link lands. */
export const LINK_FALLBACK_ROUTE = '/home';

/** "Боз үй - OYNO\noyno://open/..." - short; nothing else. */
export function linkShareText(title: string, link: string): string {
  return `${title} - OYNO\n${link}`;
}

/** The only query parameter ever read: which Home Screen widget size opened
 * the link (whitelisted; anything else is ignored). */
export function widgetSurface(via: unknown): 'small' | 'medium' | null {
  if (via === 'widget_small') return 'small';
  if (via === 'widget_medium') return 'medium';
  return null;
}
