import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { CultureCategoryDetailScreen } from '@/features/culture/CultureCategoryDetailScreen';
import { cultureCategoryImages } from '@/features/culture/data';
import { interactiveExperienceForCategory, routeForInteractiveExperience } from '@/features/culture/interactiveExperiences';
import type { CultureCategoryId } from '@/features/culture/types';
import type { SupportedLanguage } from '@/i18n';
import { cultureCategoryTitle } from '@/services/content/cultureCategoryTitles';
import { useCultureCategories } from '@/services/content/cultureService';
import { useCultureItems } from '@/services/content/cultureItemsService';

export default function CultureCategoryRoute() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const { i18n } = useTranslation();
  const { data: categories } = useCultureCategories();
  const { data: items, isLoading, error } = useCultureItems(categoryId ?? '');

  const category = categories?.find((row) => row.id === categoryId);
  const id = (categoryId ?? '') as CultureCategoryId;

  return (
    <CultureCategoryDetailScreen
      categoryId={id}
      categoryTitle={category ? cultureCategoryTitle(category, i18n.language as SupportedLanguage) : ''}
      categoryImage={cultureCategoryImages[id]}
      items={items ?? []}
      isLoading={isLoading}
      hasError={!!error}
      interactiveExperience={interactiveExperienceForCategory(id)}
      onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture'))}
      onPressItem={(item) => router.push(`/culture/item/${item.id}` as never)}
      onPressInteractiveExperience={(experienceId) => {
        const route = routeForInteractiveExperience(experienceId);
        if (route) router.push(route as never);
      }}
    />
  );
}
