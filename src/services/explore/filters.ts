export type ExploreFilterId = 'regions' | 'nature' | 'discovered' | 'undiscovered';

export type FilterableRegion = { id: string; kind: 'region' | 'nature' };

const KIND_FILTERS: ExploreFilterId[] = ['regions', 'nature'];
const STATE_FILTERS: ExploreFilterId[] = ['discovered', 'undiscovered'];

/**
 * Only real, honest filter options - Regions/Nature (both real kinds in
 * explore_regions) and Discovered/Undiscovered (real per-user visited
 * state). No Animals/Culture/Food/Places filters, since none of those
 * catalogs exist yet (see the Explore 2.0 plan's audit section).
 *
 * Filters of the same group (kind, or discovered-state) are OR'd
 * together; an empty group imposes no restriction on that axis.
 */
export function filterRegions(
  regions: FilterableRegion[],
  activeFilters: ExploreFilterId[],
  visitedRegionIds: string[],
): FilterableRegion[] {
  const activeKindFilters = activeFilters.filter((f) => KIND_FILTERS.includes(f));
  const activeStateFilters = activeFilters.filter((f) => STATE_FILTERS.includes(f));

  return regions.filter((region) => {
    const kindOk =
      activeKindFilters.length === 0 ||
      (activeKindFilters.includes('regions') && region.kind === 'region') ||
      (activeKindFilters.includes('nature') && region.kind === 'nature');

    const visited = visitedRegionIds.includes(region.id);
    const stateOk =
      activeStateFilters.length === 0 ||
      (activeStateFilters.includes('discovered') && visited) ||
      (activeStateFilters.includes('undiscovered') && !visited);

    return kindOk && stateOk;
  });
}
