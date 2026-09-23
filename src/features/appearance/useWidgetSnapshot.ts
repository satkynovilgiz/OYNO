import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useTodayDiscovery } from '@/features/daily/useTodayDiscovery';
import { natureSiteImages } from '@/features/explore/data';
import { useHomeRecommendation } from '@/features/home/useHomeRecommendation';
import { buildPassport } from '@/features/journey/passport';
import { computeTrailProgress } from '@/features/trails/trailProgress';
import { trails } from '@/features/trails/trailsData';
import { useTrailSignals } from '@/features/trails/useTrailSignals';
import type { SupportedLanguage } from '@/i18n';
import { useCultureMaterials } from '@/services/content/cultureService';
import { useExploreRegions } from '@/services/content/exploreService';
import { buildWidgetSnapshot, type WidgetSnapshot } from '@/services/widgets/widgetSnapshot';
import { useProgressStore } from '@/store/useProgressStore';

/** The widget snapshot from live app state - the same sources Home,
 * Daily, Passport and Trails use (no separate calculation). */
export function useWidgetSnapshot(): WidgetSnapshot {
  const { i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const { discovery } = useTodayDiscovery();
  const { recommendation, display } = useHomeRecommendation();
  const signals = useTrailSignals();
  const { data: regions } = useExploreRegions();
  const { data: materials } = useCultureMaterials();
  const visitedRegionIds = useProgressStore((state) => state.visitedRegionIds);
  const regionVisitDates = useProgressStore((state) => state.regionVisitDates);

  return useMemo(() => {
    const passport = buildPassport(regions ?? [], visitedRegionIds, regionVisitDates, (id) => natureSiteImages[id], language);
    return buildWidgetSnapshot({
      language,
      now: new Date(),
      daily: discovery ? { itemId: discovery.item.id, title: discovery.item.title, minutes: discovery.minutes, isCompleted: discovery.isCompleted } : null,
      journey: { eyebrow: display.eyebrow, title: display.title, progress: recommendation.progress, route: recommendation.route },
      passport: { unlocked: passport.unlocked, total: passport.total },
      trails: trails.map((trail) => {
        const progress = computeTrailProgress(trail, signals);
        return { id: trail.id, title: trail.title[language] ?? trail.title.kg, status: progress.status, completed: progress.completed, total: progress.total };
      }),
      cultureMaterials: (materials ?? []).map((row) => ({ id: row.id, kind: row.kind, title: row.title, description: row.description })),
    });
  }, [discovery, recommendation, display, signals, regions, materials, visitedRegionIds, regionVisitDates, language]);
}
