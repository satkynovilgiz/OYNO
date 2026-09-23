import type { ImageSourcePropType } from 'react-native';

import { INTERACTIVE_EXPERIENCES, routeForInteractiveExperience } from '@/features/culture/interactiveExperiences';
import { progressGameIdFor } from '@/features/games/progressGameIds';
import { gameTitleKey, type GameListItem } from '@/features/games/types';
import type { ProfileAchievement } from '@/features/profile/types';
import type { SupportedLanguage } from '@/i18n';
import type { AgeExperience } from '@/services/ageExperience/types';
import { mapDiscoveryTitle, mapExploreRegionName, type CultureItemRow, type DiscoveryRow, type ExploreRegionRow } from '@/services/content/types';
import type { GameStat } from '@/store/useProgressStore';

/**
 * Pure builder for "My OYNO Journey" - turns the progress the app ALREADY
 * tracks (useProgressStore's server-backed fields, plus the local Daily
 * OYNO completions) into passport "stamps". Nothing here is estimated or
 * padded: a stamp is `earned` only when the matching real flag/count/id
 * says so, and every section's totals come from the real catalogs (games
 * list, explore regions, discoveries, achievements), so a new user sees
 * honest zeros rather than invented progress (spec "Do not invent
 * completed progress").
 */

type TFunction = (key: string) => string;

export type JourneyStamp = {
  id: string;
  title: string;
  imageSource: ImageSourcePropType | null;
  earned: boolean;
  /** Optional honest secondary line (e.g. "3 plays · 1 win"). */
  detail: string | null;
  route: string | null;
};

export type JourneyProgressInput = {
  gameStats: Record<string, GameStat>;
  gamesPlayed: number;
  visitedRegionIds: string[];
  discoveredExploreIds: string[];
  unlockedAchievementIds: string[];
  bozUyVisited: boolean;
  oymoCreated: boolean;
  shyrdakCreated: boolean;
  komuzLessonCompleted: boolean;
  cultureDiscoveryCount: number;
};

export type JourneyCatalogs = {
  games: GameListItem[];
  regions: ExploreRegionRow[];
  discoveries: DiscoveryRow[];
  discoveryImages: Record<string, ImageSourcePropType>;
  achievements: ProfileAchievement[];
  cultureItems: CultureItemRow[];
  cultureItemImage: (itemId: string) => ImageSourcePropType | undefined;
  /** local YYYY-MM-DD -> culture item id (useDailyDiscoveryStore). */
  dailyCompletions: Record<string, string>;
};

export type JourneySummary = {
  discovered: { experiences: JourneyStamp[]; dailyItems: JourneyStamp[]; earned: number; cultureDiscoveryCount: number };
  explored: { regions: JourneyStamp[]; discoveries: JourneyStamp[]; regionsVisited: number; regionsTotal: number; discoveriesFound: number; discoveriesTotal: number };
  played: { games: JourneyStamp[]; distinctPlayed: number; total: number; sessions: number };
  achievements: { stamps: JourneyStamp[]; unlocked: number; total: number };
  totalStamps: number;
};

const EXPERIENCE_FLAG: Record<string, keyof JourneyProgressInput> = {
  'boz-uy': 'bozUyVisited',
  oymo: 'oymoCreated',
  shyrdak: 'shyrdakCreated',
  komuz: 'komuzLessonCompleted',
};

/** Earned first (in their natural order), then the rest - a passport
 * page fills up from the top rather than scattering stamps. */
function earnedFirst(stamps: JourneyStamp[]): JourneyStamp[] {
  return [...stamps.filter((stamp) => stamp.earned), ...stamps.filter((stamp) => !stamp.earned)];
}

export function buildJourneySummary(
  progress: JourneyProgressInput,
  catalogs: JourneyCatalogs,
  t: TFunction,
  language: SupportedLanguage,
  formatGameDetail: (played: number, won: number) => string,
): JourneySummary {
  const experiences = earnedFirst(
    INTERACTIVE_EXPERIENCES.map((experience) => ({
      id: experience.id,
      title: t(experience.titleKey),
      imageSource: experience.imageSource,
      earned: !!progress[EXPERIENCE_FLAG[experience.id]],
      detail: null,
      route: routeForInteractiveExperience(experience.id),
    })),
  );

  const itemById = new Map(catalogs.cultureItems.map((item) => [item.id, item]));
  const seenDailyIds = new Set<string>();
  const dailyItems: JourneyStamp[] = [];
  for (const dateKey of Object.keys(catalogs.dailyCompletions).sort().reverse()) {
    const itemId = catalogs.dailyCompletions[dateKey];
    const item = itemById.get(itemId);
    if (!item || seenDailyIds.has(itemId)) continue;
    seenDailyIds.add(itemId);
    dailyItems.push({
      id: itemId,
      title: item.title,
      imageSource: catalogs.cultureItemImage(itemId) ?? null,
      earned: true,
      detail: dateKey,
      route: `/culture/item/${itemId}`,
    });
  }

  const regionRows = catalogs.regions.filter((region) => region.kind === 'region');
  const regions = earnedFirst(
    regionRows.map((region) => {
      const name = mapExploreRegionName(region);
      return {
        id: region.id,
        title: name[language] ?? name.kg,
        imageSource: null,
        earned: progress.visitedRegionIds.includes(region.id),
        detail: null,
        route: `/explore/${region.id}`,
      };
    }),
  );

  const discoveries = earnedFirst(
    catalogs.discoveries.map((discovery) => {
      const title = mapDiscoveryTitle(discovery);
      return {
        id: discovery.id,
        title: title[language] ?? title.kg,
        imageSource: catalogs.discoveryImages[discovery.id] ?? null,
        earned: progress.discoveredExploreIds.includes(discovery.id),
        detail: null,
        route: discovery.region_id ? `/explore/${discovery.region_id}` : '/explore',
      };
    }),
  );

  // Only games that can actually be played today - a "not yet built" game
  // can never be stamped, so it has no place on the page.
  const playable = catalogs.games.filter((game) => !!game.route);
  const games = earnedFirst(
    playable.map((game) => {
      const stat = progress.gameStats[progressGameIdFor(game.id)];
      const played = stat?.played ?? 0;
      return {
        id: game.id,
        title: t(gameTitleKey(game.id)),
        imageSource: game.thumbnail ?? null,
        earned: played > 0,
        detail: played > 0 ? formatGameDetail(played, stat?.won ?? 0) : null,
        route: game.route ?? null,
      };
    }),
  );

  const achievementStamps = earnedFirst(
    catalogs.achievements.map((achievement) => ({
      id: achievement.id,
      title: t(achievement.titleKey),
      imageSource: achievement.iconSource,
      earned: progress.unlockedAchievementIds.includes(achievement.id),
      detail: null,
      route: '/achievements',
    })),
  );

  const count = (stamps: JourneyStamp[]) => stamps.filter((stamp) => stamp.earned).length;
  const discoveredEarned = count(experiences) + dailyItems.length;
  const regionsVisited = count(regions);
  const discoveriesFound = count(discoveries);
  const distinctPlayed = count(games);
  const unlocked = count(achievementStamps);

  return {
    discovered: { experiences, dailyItems, earned: discoveredEarned, cultureDiscoveryCount: progress.cultureDiscoveryCount },
    explored: { regions, discoveries, regionsVisited, regionsTotal: regions.length, discoveriesFound, discoveriesTotal: discoveries.length },
    played: { games, distinctPlayed, total: games.length, sessions: progress.gamesPlayed },
    achievements: { stamps: achievementStamps, unlocked, total: achievementStamps.length },
    totalStamps: discoveredEarned + regionsVisited + discoveriesFound + distinctPlayed + unlocked,
  };
}

export type NextDiscovery = { kind: 'daily' | 'experience' | 'game' | 'region'; stamp: JourneyStamp };

/**
 * One real next step (spec "NEXT DISCOVERY: One meaningful existing piece
 * of content the user can continue with"), in order: today's discovery if
 * it isn't done yet, then the first interactive experience never tried,
 * the first playable game never played, the first region never visited.
 * Returns null when the user has genuinely done all of it.
 */
export function pickNextDiscovery(summary: JourneySummary, today: JourneyStamp | null): NextDiscovery | null {
  if (today && !today.earned) return { kind: 'daily', stamp: today };
  const experience = summary.discovered.experiences.find((stamp) => !stamp.earned && stamp.route);
  if (experience) return { kind: 'experience', stamp: experience };
  const game = summary.played.games.find((stamp) => !stamp.earned && stamp.route);
  if (game) return { kind: 'game', stamp: game };
  const region = summary.explored.regions.find((stamp) => !stamp.earned);
  if (region) return { kind: 'region', stamp: region };
  return null;
}

export type JourneySectionId = 'next' | 'discovered' | 'explored' | 'played' | 'achievements';

export const ALL_JOURNEY_SECTIONS: JourneySectionId[] = ['next', 'discovered', 'explored', 'played', 'achievements'];

/**
 * Same sections for every age, different emphasis (spec "Child → simpler,
 * visual / Teen → adventure/progression / Adult → elegant cultural
 * journal"): child leads with the next thing to do and the most visual
 * stamps (games, medals); preteen/teen lead with the next step and the
 * exploration map-progress; adult reads like a journal - what was
 * discovered and explored first, the "what next" suggestion last.
 */
const JOURNEY_SECTION_ORDER: Record<AgeExperience, JourneySectionId[]> = {
  child: ['next', 'played', 'achievements', 'discovered', 'explored'],
  preteen: ['next', 'played', 'explored', 'achievements', 'discovered'],
  teen: ['next', 'explored', 'played', 'achievements', 'discovered'],
  adult: ['discovered', 'explored', 'played', 'achievements', 'next'],
};

export function getJourneySectionOrder(experience: AgeExperience): JourneySectionId[] {
  return JOURNEY_SECTION_ORDER[experience];
}
