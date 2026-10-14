import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ContentQueryGate } from '@/components/state/ContentQueryGate';
import { MaterialDetailScreen } from '@/features/culture/MaterialDetailScreen';
import { useCultureMaterial } from '@/services/content/cultureService';

export default function CultureMaterialRoute() {
  const { t } = useTranslation();
  const { materialId } = useLocalSearchParams<{ materialId: string }>();
  const materialQuery = useCultureMaterial(materialId ?? '');

  return (
    <ContentQueryGate query={materialQuery} fallbackRoute="/culture" loadingLabel={t('states.loadingArticle')} errorTitle={t('states.articleError')}>
      {(loaded) => <MaterialDetailScreen material={loaded} onPressBack={() => router.back()} />}
    </ContentQueryGate>
  );
}
