import type { ImageSourcePropType } from 'react-native';

import kokBoruArt from '@assets/img/OYNO_design/culture/horse/kok_boru_flag.jpg';
import kyzKuumaiArt from '@assets/img/OYNO_design/culture/horse/kyz_kuumai.jpg';
import gamesWorldHero from '@assets/img/games/art/games_world_hero.jpg';
import zhaaAtuuArt from '@assets/img/games/art/zhaa_atuu_featured.jpg';

import type { GameStat } from '@/store/useProgressStore';

import { mockGamesList } from './mockData';
import { progressGameIdFor } from './progressGameIds';
import type { GameCategory, GameListItem } from './types';

/**
 * Presentation helpers for the Games tab and Game Detail. They only ever
 * READ the one game catalog (`mockGamesList`) and the real play stats -
 * no second game list, no invented history, levels or ranks.
 */

/** Cinematic art for the Games hero (a traditional horseback game scene). */
export const GAMES_HERO_ART: ImageSourcePropType = gamesWorldHero;

/**
 * Large-format art for games whose card thumbnail is too small for a
 * full-width card. Only real OYNO assets: the Horse Culture photography
 * and the OYNO traditional-games artwork (archery set).
 */
const LARGE_ART: Record<string, ImageSourcePropType> = {
  'kok-boru': kokBoruArt,
  'kyz-kuumay': kyzKuumaiArt,
  'zhaa-atuu': zhaaAtuuArt,
};

/** Best available art for a card size; null = use the polished fallback. */
export function gameArt(game: Pick<GameListItem, 'id' | 'thumbnail'>, size: 'large' | 'card'): ImageSourcePropType | null {
  if (size === 'large') return LARGE_ART[game.id] ?? game.thumbnail ?? null;
  return game.thumbnail ?? LARGE_ART[game.id] ?? null;
}

export function isPlayable(game: GameListItem): boolean {
  return !!game.route;
}

/** Real plays/wins for a list game (3D games record under their own ids). */
export function gameStatsFor(game: Pick<GameListItem, 'id'>, stats: Record<string, GameStat>): GameStat {
  return stats[progressGameIdFor(game.id)] ?? { played: 0, won: 0 };
}

/** The list game for a progress id (Game Detail receives progress ids). */
export function listGameForProgressId(progressId: string): GameListItem | undefined {
  return mockGamesList.find((game) => progressGameIdFor(game.id) === progressId || game.id === progressId);
}

/**
 * "Play again": the playable game the user has really played the most.
 * OYNO records play COUNTS, not timestamps, so this is never labelled
 * "continue" or "last played" - null when there's no real play at all.
 */
export function pickPlayAgain(games: GameListItem[], stats: Record<string, GameStat>): { game: GameListItem; stat: GameStat } | null {
  let best: { game: GameListItem; stat: GameStat } | null = null;
  for (const game of games) {
    if (!isPlayable(game)) continue;
    const stat = gameStatsFor(game, stats);
    if (stat.played > 0 && (!best || stat.played > best.stat.played)) best = { game, stat };
  }
  return best;
}

/** Games that can carry the big Featured card: playable + large art. */
export const FEATURED_CANDIDATES = ['kok-boru', 'kyz-kuumay', 'zhaa-atuu'] as const;

/**
 * Today's featured game - rotates daily (same pick all day, for everyone)
 * among playable games with large art, skipping the "play again" game so
 * the two hero slots never show the same game.
 */
export function pickFeaturedGame(games: GameListItem[], dayNumber: number, excludeId?: string | null): GameListItem | null {
  const candidates = FEATURED_CANDIDATES.map((id) => games.find((game) => game.id === id)).filter(
    (game): game is GameListItem => !!game && isPlayable(game) && game.id !== excludeId,
  );
  if (candidates.length === 0) return games.find((game) => isPlayable(game) && game.id !== excludeId) ?? null;
  return candidates[((dayNumber % candidates.length) + candidates.length) % candidates.length];
}

/** Section order on the Games tab - the existing categories, nothing new. */
export const CATEGORY_ORDER: GameCategory[] = ['horse', 'national', 'skill', 'logic', 'team', 'cooking', 'music'];

/** Category sections straight from each game's own `category`; playable
 * games first, empty categories omitted. */
export function gameSections(games: GameListItem[]): { category: GameCategory; games: GameListItem[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    games: games.filter((game) => game.category === category).sort((a, b) => Number(isPlayable(b)) - Number(isPlayable(a))),
  })).filter((section) => section.games.length > 0);
}

/** The short "what is this" line that already exists for a game, if any. */
const DESCRIPTION_KEY: Record<string, string> = {
  chuko: 'games3d.chuko.aboutDescription',
  ordo: 'games3d.ordo.aboutDescription',
  'zhaa-atuu': 'games3d.jaaAtuu.aboutDescription',
  'kyz-kuumay': 'games3d.kyzKuumai.aboutDescription',
  'kok-boru': 'games3d.kokBoru.aboutDescription',
};

export function gameDescriptionKey(gameId: string): string | null {
  return DESCRIPTION_KEY[gameId] ?? null;
}

/** First sentence only - cards stay short. */
export function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](\s|$)/);
  return (match ? match[0] : text).trim();
}
