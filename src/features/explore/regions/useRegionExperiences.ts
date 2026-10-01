import { useMemo } from 'react';

import { useRegionLinks } from '@/services/content/regionLinksService';

import { resolveRegionExperiences, type RegionExperienceConfig } from './regionExperiences';

/** The resolved region model every screen reads (built-in links until an
 * editor has curated a region). */
export function useRegionExperiences(): RegionExperienceConfig[] {
  const { data: links } = useRegionLinks();
  return useMemo(() => resolveRegionExperiences(links), [links]);
}

export function useRegionExperience(id: string | null | undefined): RegionExperienceConfig | null {
  const configs = useRegionExperiences();
  return (id && configs.find((config) => config.id === id)) || null;
}
