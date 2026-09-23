import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ImageSourcePropType } from 'react-native';

import { cultureItemImages } from '@/features/culture/data';
import type { SupportedLanguage } from '@/i18n';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useCultureCategories } from '@/services/content/cultureService';
import type { CultureItemRow } from '@/services/content/types';
import { dailyDiscoveryPool, estimateReadMinutes, localDateKey, pickDailyDiscovery } from '@/services/daily/dailyDiscovery';
import { useDailyDiscoveryStore } from '@/store/useDailyDiscoveryStore';

import { buildDailyTextBlocks, type DailyTextBlock } from './dailyContent';

export function dailyImageOf(itemId: string): ImageSourcePropType | undefined {
  return cultureItemImages[itemId]?.[0];
}

export type TodayDiscovery = {
  dateKey: string;
  item: CultureItemRow;
  pool: CultureItemRow[];
  imageSource: ImageSourcePropType;
  categoryTitle: string | null;
  textBlocks: DailyTextBlock[];
  minutes: number;
  isCompleted: boolean;
};

/** Today's discovery for the current local date, resolved from the same
 * `culture_items`/`culture_categories` queries Search/Saved/Collections
 * already share (react-query dedupes them) - Home's entry card and the
 * Daily screen both read this, so they can never disagree about the day's
 * item or whether it's done. */
export function useTodayDiscovery(): { isLoading: boolean; discovery: TodayDiscovery | null } {
  const { i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const { experience } = useAgeExperience();
  const { data: items, isLoading: itemsLoading } = useAllCultureItems();
  const { data: categories } = useCultureCategories();
  const completions = useDailyDiscoveryStore((state) => state.completions);
  const dateKey = localDateKey();

  const discovery = useMemo<TodayDiscovery | null>(() => {
    const pool = dailyDiscoveryPool(items ?? [], (id) => !!dailyImageOf(id));
    // Once today is completed, keep showing the item that was actually
    // completed even if the pool shifted since (content added/removed).
    const completedId = completions[dateKey];
    const item = (completedId ? pool.find((row) => row.id === completedId) : null) ?? pickDailyDiscovery(pool, dateKey);
    const imageSource = item ? dailyImageOf(item.id) : undefined;
    if (!item || !imageSource) return null;

    const textBlocks = buildDailyTextBlocks(item, experience, language);
    return {
      dateKey,
      item,
      pool,
      imageSource,
      categoryTitle: categories?.find((category) => category.id === item.category_id)?.title ?? null,
      textBlocks,
      minutes: estimateReadMinutes(textBlocks.map((block) => block.text)),
      isCompleted: !!completedId,
    };
  }, [items, categories, completions, dateKey, experience, language]);

  return { isLoading: itemsLoading, discovery };
}
