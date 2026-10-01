import type { QueryClient } from '@tanstack/react-query';

import type { RegionExperienceConfig } from '@/features/explore/regions/regionExperiences';
import { REGION_INTROS_KEY, REGION_LINKS_KEY, type RegionLinkType } from '@/services/content/regionLinksService';

/**
 * Admin Region Curator - pure rules behind /admin/regions/[id]. No UI, no
 * network. The editor only chooses WHICH existing content a region shows
 * and in what order; ids, order of regions, heroes, tones, challenge packs
 * and the progress rules stay in the app.
 */

export type RegionDraft = Pick<RegionExperienceConfig, 'destinationIds' | 'discoveryIds' | 'cultureItemIds' | 'materialIds' | 'trailIds' | 'questIds'>;
export type DraftField = keyof RegionDraft;

export const DRAFT_FIELDS: { field: DraftField; type: RegionLinkType; label: string }[] = [
  { field: 'destinationIds', type: 'destination', label: 'Places' },
  { field: 'discoveryIds', type: 'discovery', label: 'Discoveries' },
  { field: 'cultureItemIds', type: 'culture_item', label: 'Culture items' },
  { field: 'materialIds', type: 'culture_material', label: 'Culture materials' },
  { field: 'trailIds', type: 'trail', label: 'Trails' },
  { field: 'questIds', type: 'quest', label: 'Guided quests' },
];

export function draftFromConfig(config: RegionExperienceConfig): RegionDraft {
  return {
    destinationIds: [...config.destinationIds],
    discoveryIds: [...config.discoveryIds],
    cultureItemIds: [...config.cultureItemIds],
    materialIds: [...config.materialIds],
    trailIds: [...config.trailIds],
    questIds: [...config.questIds],
  };
}

export function isDraftDirty(saved: RegionDraft, draft: RegionDraft): boolean {
  return DRAFT_FIELDS.some(({ field }) => saved[field].join('|') !== draft[field].join('|'));
}

/** Rows for admin_set_region_links: sort_order is the position within its
 * type. The region itself is always the first place. */
export function draftToLinks(regionId: string, draft: RegionDraft): { content_type: RegionLinkType; content_id: string; sort_order: number }[] {
  const places = [regionId, ...draft.destinationIds.filter((id) => id !== regionId)];
  return DRAFT_FIELDS.flatMap(({ field, type }) => (field === 'destinationIds' ? places : draft[field]).map((id, index) => ({ content_type: type, content_id: id, sort_order: index })));
}

/** Move within a list; the region's own place (index 0 of Places) is locked. */
export function moveItem(list: readonly string[], index: number, delta: -1 | 1, lockedFirst = false): string[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return [...list];
  if (lockedFirst && (index === 0 || target === 0)) return [...list];
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function removeItem(list: readonly string[], index: number, lockedFirst = false): string[] {
  if (lockedFirst && index === 0) return [...list];
  return list.filter((_, position) => position !== index);
}

export function addItem(list: readonly string[], id: string): string[] {
  return list.includes(id) ? [...list] : [...list, id];
}

export type RegionCatalog = {
  /** Undefined = still loading; a loading type is never reported broken. */
  destinationIds?: ReadonlySet<string>;
  /** discovery id -> its region_id. */
  discoveryRegion?: ReadonlyMap<string, string | null>;
  cultureItemIds?: ReadonlySet<string>;
  materialIds?: ReadonlySet<string>;
  trailIds: ReadonlySet<string>;
  questIds: ReadonlySet<string>;
  supportedRegionIds: ReadonlySet<string>;
};

/**
 * Save blockers: unknown region, the region not first, duplicates, links to
 * content that doesn't exist, a discovery from another region, or a place
 * another region already claims (a place belongs to one region only).
 */
export function validateRegionDraft(regionId: string, draft: RegionDraft, catalog: RegionCatalog, otherRegions: readonly RegionExperienceConfig[] = []): string[] {
  const problems: string[] = [];
  if (!catalog.supportedRegionIds.has(regionId)) return [`Unknown region: ${regionId}`];
  if (draft.destinationIds[0] !== regionId) problems.push('The region itself must stay the first place.');
  for (const { field, label } of DRAFT_FIELDS) {
    if (new Set(draft[field]).size !== draft[field].length) problems.push(`${label}: duplicate entry.`);
  }
  const broken = (ids: readonly string[], known: ReadonlySet<string> | undefined, label: string) => {
    if (!known) return;
    for (const id of ids) if (!known.has(id)) problems.push(`${label}: "${id}" doesn't exist.`);
  };
  broken(draft.destinationIds, catalog.destinationIds, 'Places');
  broken(draft.cultureItemIds, catalog.cultureItemIds, 'Culture items');
  broken(draft.materialIds, catalog.materialIds, 'Culture materials');
  broken(draft.trailIds, catalog.trailIds, 'Trails');
  broken(draft.questIds, catalog.questIds, 'Guided quests');
  if (catalog.discoveryRegion) {
    for (const id of draft.discoveryIds) {
      if (!catalog.discoveryRegion.has(id)) problems.push(`Discoveries: "${id}" doesn't exist.`);
      else if (catalog.discoveryRegion.get(id) !== regionId) problems.push(`Discoveries: "${id}" belongs to another region.`);
    }
  }
  for (const other of otherRegions) {
    if (other.id === regionId) continue;
    for (const id of draft.destinationIds.slice(1)) if (other.destinationIds.includes(id)) problems.push(`Places: "${id}" is already in ${other.id}.`);
  }
  return problems;
}

export const INTRO_MAX = 300;

/** Mirrors the database check on region_intros.intro. Empty = use the
 * app's built-in intro. */
export function validateIntro(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > INTRO_MAX) return `Keep it under ${INTRO_MAX} characters (${trimmed.length}).`;
  if (/[<>{}]/.test(trimmed)) return 'Plain text only - no < > { } characters.';
  return null;
}

/** Server error codes -> a sentence an editor can act on. */
export function regionSaveErrorMessage(error: unknown): string {
  const message = String((error as { message?: string } | null)?.message ?? error ?? '');
  if (message.includes('NOT_AUTHORIZED') || message.includes('permission denied')) return "This account can't edit regions.";
  if (message.includes('UNKNOWN_REGION')) return 'This region is not supported.';
  if (message.includes('BROKEN_LINK')) return `A linked item no longer exists (${message.split('BROKEN_LINK:')[1]?.trim() ?? 'unknown'}). Remove it and save again.`;
  if (message.includes('DUPLICATE_LINK')) return 'The same item is linked twice.';
  if (message.includes('does not exist') || message.includes('PGRST202') || message.includes('Could not find the function')) return 'Region curation is not available on this backend yet (migration not applied).';
  return 'Saving failed. Nothing was changed - try again.';
}

/** After a save every screen reading regions refetches the curated rows. */
export async function invalidateRegionCuration(queryClient: Pick<QueryClient, 'invalidateQueries'>): Promise<void> {
  await Promise.all([queryClient.invalidateQueries({ queryKey: REGION_LINKS_KEY }), queryClient.invalidateQueries({ queryKey: REGION_INTROS_KEY })]);
}
