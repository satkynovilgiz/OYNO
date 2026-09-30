import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { natureSiteCoordinates } from '@/features/explore/data';
import { InteractiveMapScreen } from '@/features/explore/map/InteractiveMapScreen';
import { getRegionExperience } from '@/features/explore/regions/regionExperiences';
import { regionMapHighlightIds } from '@/features/explore/regions/regionModel';
import { getTrail } from '@/features/trails/trailsData';
import type { SupportedLanguage } from '@/i18n';
import { useExploreRegion } from '@/services/content/exploreService';
import { mapExploreRegionName } from '@/services/content/types';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function ExploreMapRoute() {
  const { i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  // Opened from a Guided Trail (/explore/map?trail=<id>) or a Region Hub
  // (/explore/map?region=<id>): highlight only those destinations. A region
  // with no pinned place opens the map unfiltered.
  const { trail: trailId, region: regionId } = useLocalSearchParams<{ trail?: string; region?: string }>();
  const trail = trailId ? getTrail(trailId) : undefined;
  const region = !trail ? getRegionExperience(regionId) : null;
  const regionHighlights = region ? regionMapHighlightIds(region, Object.keys(natureSiteCoordinates)) : [];
  const { data: regionRow } = useExploreRegion(regionHighlights.length > 0 ? region?.id : undefined);

  const highlightIds = trail ? trail.steps.filter((step) => step.type === 'destination').map((step) => step.id) : regionHighlights.length > 0 ? regionHighlights : undefined;
  const highlightTitle = trail ? (trail.title[language] ?? trail.title.kg) : regionHighlights.length > 0 && regionRow ? (mapExploreRegionName(regionRow)[language] ?? regionRow.name_kg) : undefined;

  return <InteractiveMapScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} highlightIds={highlightIds} highlightTitle={highlightTitle} />;
}
