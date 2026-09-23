import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { InteractiveMapScreen } from '@/features/explore/map/InteractiveMapScreen';
import { getTrail } from '@/features/trails/trailsData';
import type { SupportedLanguage } from '@/i18n';

export default function ExploreMapRoute() {
  const { i18n } = useTranslation();
  // Opened from a Guided Trail (/explore/map?trail=<id>): highlight only
  // that trail's destinations.
  const { trail: trailId } = useLocalSearchParams<{ trail?: string }>();
  const trail = trailId ? getTrail(trailId) : undefined;
  const highlightIds = trail?.steps.filter((step) => step.type === 'destination').map((step) => step.id);

  return (
    <InteractiveMapScreen
      onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/explore'))}
      highlightIds={highlightIds}
      highlightTitle={trail ? (trail.title[i18n.language as SupportedLanguage] ?? trail.title.kg) : undefined}
    />
  );
}
