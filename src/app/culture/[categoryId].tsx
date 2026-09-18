import { router, useLocalSearchParams } from 'expo-router';

import { CultureCategoryDetailScreen } from '@/features/culture/CultureCategoryDetailScreen';
import { cultureCategoryImages, cultureCategoryMockProgress } from '@/features/culture/data';
import { interactiveExperienceForCategory, routeForInteractiveExperience } from '@/features/culture/interactiveExperiences';
import type { CultureCategoryId } from '@/features/culture/types';
import { useCultureCategories } from '@/services/content/cultureService';
import { useCultureItems } from '@/services/content/cultureItemsService';

export default function CultureCategoryRoute() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const { data: categories } = useCultureCategories();
  const { data: items, isLoading, error } = useCultureItems(categoryId ?? '');

  const category = categories?.find((row) => row.id === categoryId);
  const id = (categoryId ?? '') as CultureCategoryId;

  return (
    <CultureCategoryDetailScreen
      categoryId={id}
      categoryTitle={category?.title ?? ''}
      categoryImage={cultureCategoryImages[id]}
      progress={cultureCategoryMockProgress[id] ?? { current: 0, total: 0 }}
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
