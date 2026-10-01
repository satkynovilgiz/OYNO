import type { ShareCardContent } from '@/components/share/ShareCard';

import type { RegionExperienceConfig } from './regionExperiences';

/**
 * Region Hub rules - pure, deterministic, no network. Progress counts only
 * explicit actions the app already records; nothing is estimated.
 */

export type RegionSignals = {
  visitedRegionIds: readonly string[];
  discoveredIds: readonly string[];
  /** Per linked trail: completed/total of its trackable stops. */
  trails: Record<string, { completed: number; total: number }>;
  /** Per linked guided quest: completed/total steps. */
  quests: Record<string, { completed: number; total: number }>;
};

export type RegionProgress = {
  completed: number;
  total: number;
  /** 0..100, rounded. */
  percent: number;
  /** Separate counts for the summary line. */
  places: { visited: number; total: number };
  discoveries: { found: number; total: number };
};

/**
 * One unit per explicit action: visiting a linked destination, finding a
 * linked discovery, completing a linked trail stop or guided quest step.
 * Opening a culture article is NOT counted (no meaningful completion signal).
 */
export function computeRegionProgress(config: RegionExperienceConfig, signals: RegionSignals): RegionProgress {
  const visited = config.destinationIds.filter((id) => signals.visitedRegionIds.includes(id)).length;
  const found = config.discoveryIds.filter((id) => signals.discoveredIds.includes(id)).length;
  const trail = config.trailIds.reduce((sum, id) => ({ completed: sum.completed + (signals.trails[id]?.completed ?? 0), total: sum.total + (signals.trails[id]?.total ?? 0) }), { completed: 0, total: 0 });
  const quest = config.questIds.reduce((sum, id) => ({ completed: sum.completed + (signals.quests[id]?.completed ?? 0), total: sum.total + (signals.quests[id]?.total ?? 0) }), { completed: 0, total: 0 });
  const completed = visited + found + trail.completed + quest.completed;
  const total = config.destinationIds.length + config.discoveryIds.length + trail.total + quest.total;
  return {
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    places: { visited, total: config.destinationIds.length },
    discoveries: { found, total: config.discoveryIds.length },
  };
}

export type StartHere =
  | { kind: 'destination'; id: string }
  /** A discovery is found on its destination page. */
  | { kind: 'discovery'; id: string; destinationId: string }
  | { kind: 'trail'; id: string }
  | { kind: 'quest'; id: string }
  | { kind: 'done' };

/**
 * The next real unfinished activity, in a fixed order: unvisited place ->
 * unfound discovery -> unfinished trail -> unfinished quest. No
 * recommendation logic beyond that order.
 */
export function pickStartHere(config: RegionExperienceConfig, signals: RegionSignals): StartHere {
  const place = config.destinationIds.find((id) => !signals.visitedRegionIds.includes(id));
  if (place) return { kind: 'destination', id: place };
  const discovery = config.discoveryIds.find((id) => !signals.discoveredIds.includes(id));
  if (discovery) return { kind: 'discovery', id: discovery, destinationId: config.id };
  const trail = config.trailIds.find((id) => {
    const progress = signals.trails[id];
    return progress && progress.total > 0 && progress.completed < progress.total;
  });
  if (trail) return { kind: 'trail', id: trail };
  const quest = config.questIds.find((id) => {
    const progress = signals.quests[id];
    return progress && progress.total > 0 && progress.completed < progress.total;
  });
  if (quest) return { kind: 'quest', id: quest };
  return { kind: 'done' };
}

/** Pins to highlight on the interactive map: the region's destinations that
 * the map actually shows (it pins the Passport nature sites). May be empty -
 * the map then opens unfiltered, never with everything dimmed. */
export function regionMapHighlightIds(config: RegionExperienceConfig, mapPlaceIds: readonly string[]): string[] {
  return config.destinationIds.filter((id) => mapPlaceIds.includes(id));
}

/** Region share card - hero, name, a progress line, OYNO branding. Public
 * content only. */
export function buildRegionShareCard(input: { name: string; label: string; progressLine: string; imageSource: RegionExperienceConfig['heroImage']; fallbackTone: string }): ShareCardContent {
  return { title: input.name, label: input.label, subtitle: input.progressLine, imageSource: input.imageSource ?? null, fallbackTone: input.fallbackTone };
}

/** Link-integrity problems for a config against the real catalog (tests). */
export function validateRegionExperience(
  config: RegionExperienceConfig,
  catalog: {
    regionIds: ReadonlySet<string>;
    discoveryRegion: ReadonlyMap<string, string | null>;
    cultureItemIds: ReadonlySet<string>;
    materialIds: ReadonlySet<string>;
    trailIds: ReadonlySet<string>;
    questIds: ReadonlySet<string>;
  },
): string[] {
  const problems: string[] = [];
  const dupes = (list: string[], label: string) => {
    if (new Set(list).size !== list.length) problems.push(`duplicate ${label}`);
  };
  if (!catalog.regionIds.has(config.id)) problems.push(`region ${config.id} missing`);
  if (config.destinationIds[0] !== config.id) problems.push('the region itself must be the first place');
  dupes(config.destinationIds, 'destination ids');
  dupes(config.discoveryIds, 'discovery ids');
  for (const id of config.destinationIds) if (!catalog.regionIds.has(id)) problems.push(`destination ${id} missing`);
  for (const id of config.discoveryIds) {
    if (!catalog.discoveryRegion.has(id)) problems.push(`discovery ${id} missing`);
    else if (catalog.discoveryRegion.get(id) !== config.id) problems.push(`discovery ${id} belongs to another region`);
  }
  for (const id of config.cultureItemIds) if (!catalog.cultureItemIds.has(id)) problems.push(`culture item ${id} missing`);
  for (const id of config.materialIds) if (!catalog.materialIds.has(id)) problems.push(`material ${id} missing`);
  for (const id of config.trailIds) if (!catalog.trailIds.has(id)) problems.push(`trail ${id} missing`);
  for (const id of config.questIds) if (!catalog.questIds.has(id)) problems.push(`quest ${id} missing`);
  return problems;
}

export type RegionStatus = 'not_started' | 'in_progress' | 'completed';

/** The one region state rule, used by the Passport, the map and Home:
 * completed only when every counted action is done AND there is something
 * to count; opening a region page never completes it. */
export function regionStatus(progress: Pick<RegionProgress, 'completed' | 'total'>): RegionStatus {
  if (progress.total > 0 && progress.completed === progress.total) return 'completed';
  return progress.completed > 0 ? 'in_progress' : 'not_started';
}

/** "Regions started X / 7, completed Y / 7" - two honest counts, never one
 * blended percentage. Started includes completed. */
export function regionSummary(configs: readonly RegionExperienceConfig[], signals: RegionSignals): { started: number; completed: number; total: number } {
  let started = 0;
  let completed = 0;
  for (const config of configs) {
    const status = regionStatus(computeRegionProgress(config, signals));
    if (status !== 'not_started') started += 1;
    if (status === 'completed') completed += 1;
  }
  return { started, completed, total: configs.length };
}

/**
 * Regions that changed to completed since the last look. `previous` null =
 * first look (app start / account change): nothing is announced, so an old
 * completion - or another account's - is never celebrated.
 */
export function newlyCompletedRegions(previous: Readonly<Record<string, RegionStatus>> | null, next: Readonly<Record<string, RegionStatus>>): string[] {
  if (!previous) return [];
  return Object.keys(next).filter((id) => next[id] === 'completed' && previous[id] !== 'completed');
}
