import { router, useLocalSearchParams } from 'expo-router';

import { CultureCategoryScreen } from '@/features/culture/CultureCategoryScreen';
import { useCultureCategories } from '@/services/content/cultureService';
import { useCultureItems } from '@/services/content/cultureItemsService';

export default function CultureCategoryRoute() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const { data: categories } = useCultureCategories();
  const { data: items, isLoading, error } = useCultureItems(categoryId ?? '');

  const category = categories?.find((row) => row.id === categoryId);

  return (
    <CultureCategoryScreen
      categoryTitle={category?.title ?? ''}
      items={items ?? []}
      isLoading={isLoading}
      hasError={!!error}
      onPressBack={() => router.back()}
      onPressItem={(item) => router.push(`/culture/item/${item.id}` as never)}
    />
  );
}
