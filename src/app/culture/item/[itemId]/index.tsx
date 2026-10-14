import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { ContentQueryGate } from '@/components/state/ContentQueryGate';
import { cultureItemAudio } from '@/features/culture/audioData';
import { cultureItemImages } from '@/features/culture/data';
import { CultureItemDetailScreen } from '@/features/culture/CultureItemDetailScreen';
import { useCultureItem } from '@/services/content/cultureItemsService';
import { useProgressStore } from '@/store/useProgressStore';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function CultureItemRoute() {
  const { t } = useTranslation();
  const { itemId, section } = useLocalSearchParams<{ itemId: string; section?: string }>();
  const itemQuery = useCultureItem(itemId ?? '');
  const item = itemQuery.data;

  useEffect(() => {
    if (!item) return;
    void useProgressStore.getState().advanceQuestStep('OPEN_CULTURE_ITEM', item.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  return (
    <ContentQueryGate query={itemQuery} fallbackRoute="/culture" loadingLabel={t('states.loadingArticle')} errorTitle={t('states.articleError')}>
      {(loaded) => (
        <CultureItemDetailScreen
          item={loaded}
          images={cultureItemImages[loaded.id]}
          audioTracks={cultureItemAudio[loaded.id]}
          initialSection={typeof section === 'string' ? section : undefined}
          onPressBack={() => (router.canGoBack() ? router.back() : router.replace(`/culture/${loaded.category_id}`))}
        />
      )}
    </ContentQueryGate>
  );
}
