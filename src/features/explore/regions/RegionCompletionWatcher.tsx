import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { showToast } from '@/components/ui/Toast';
import type { SupportedLanguage } from '@/i18n';
import { useExploreRegions } from '@/services/content/exploreService';
import { mapExploreRegionName } from '@/services/content/types';
import { useAuthStore } from '@/store/useAuthStore';
import { useProgressStore } from '@/store/useProgressStore';

import { useRegionExperiences } from './useRegionExperiences';
import { computeRegionProgress, newlyCompletedRegions, regionStatus, type RegionStatus } from './regionModel';
import { useRegionSignals } from './useRegionSignals';

const ACCOUNT_SYNC_QUIET_MS = 10_000;

/**
 * The restrained region completion moment: one quiet toast ("Naryn
 * explored") the moment a region becomes completed. Derived from region
 * progress only; the baseline resets on app start and on account change,
 * so nothing old or another account's is ever announced. No confetti, no
 * reward. Mounted once at the root; renders nothing.
 */
export function RegionCompletionWatcher() {
  const { t, i18n } = useTranslation();
  const signals = useRegionSignals();
  const { data: rows } = useExploreRegions();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  // Progress arrives asynchronously at start - take the baseline only once
  // it is loaded, so an existing completion is never announced as new.
  const progressLoaded = useProgressStore((state) => state.isLoaded);
  const configs = useRegionExperiences();
  const previous = useRef<Record<string, RegionStatus> | null>(null);
  const owner = useRef<string | null>(accountId);
  // After an account change the new account's progress syncs in over a few
  // seconds; during this quiet window the baseline just follows it.
  const quietUntil = useRef(0);

  useEffect(() => {
    if (!progressLoaded) {
      previous.current = null;
      return;
    }
    if (owner.current !== accountId) {
      owner.current = accountId;
      previous.current = null;
      quietUntil.current = Date.now() + ACCOUNT_SYNC_QUIET_MS;
    }
    const next = Object.fromEntries(configs.map((config) => [config.id, regionStatus(computeRegionProgress(config, signals))]));
    const quiet = Date.now() < quietUntil.current;
    for (const id of quiet ? [] : newlyCompletedRegions(previous.current, next)) {
      const row = rows?.find((candidate) => candidate.id === id);
      if (row) showToast(t('journey.regions.explored', { name: mapExploreRegionName(row)[i18n.language as SupportedLanguage] ?? row.name_kg }));
    }
    previous.current = next;
  }, [signals, accountId, progressLoaded, rows, t, i18n.language, configs]);

  return null;
}
