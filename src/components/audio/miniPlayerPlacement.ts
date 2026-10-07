/** The five tab screens - they draw the bottom tab bar, so the mini player
 * floats just above it there. */
const TAB_ROUTES = new Set(['/home', '/games', '/explore', '/culture', '/profile']);

/** Reading/browsing screens where a narration can keep going in the mini
 * player. Games, labs, the full map (its own bottom sheet), challenges,
 * sign-in/onboarding and admin never show it. */
const CONTENT_ROUTES = ['/culture/item', '/culture/material', '/daily', '/saved', '/search', '/journey', '/collections', '/collection', '/trails', '/quests', '/explore/search'];

/** Interactive labs and the quiz (category pages like /culture/shyrdak are
 * reading screens and keep the mini player). */
const CULTURE_LABS = ['/culture/boz-uy/build', '/culture/oymo/create', '/culture/oymo/restore', '/culture/shyrdak/create', '/culture/komuz/learn', '/culture/quiz', '/culture/detective', '/culture/duel'];

export type MiniPlayerPlacement = 'aboveTabBar' | 'bottom' | null;

export function miniPlayerPlacement(pathname: string): MiniPlayerPlacement {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (TAB_ROUTES.has(path)) return 'aboveTabBar';
  if (CULTURE_LABS.some((lab) => path.startsWith(lab))) return null;
  if (CONTENT_ROUTES.some((route) => path === route || path.startsWith(`${route}/`))) return 'bottom';
  // A destination (/explore/<id>) or a culture category (/culture/<id>).
  if (/^\/explore\/[^/]+$/.test(path) && path !== '/explore/map' && path !== '/explore/map-challenge') return 'bottom';
  if (/^\/culture\/[^/]+$/.test(path)) return 'bottom';
  return null;
}
