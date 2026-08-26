import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { LegalDocumentScreen } from '@/features/settings/LegalDocumentScreen';

type LegalSection = { heading: string; body: string };

export default function TermsOfUseRoute() {
  const { t } = useTranslation();
  const sections = t('legal.termsOfUse.sections', { returnObjects: true }) as LegalSection[];

  return (
    <LegalDocumentScreen
      title={t('legal.termsOfUse.title')}
      updated={t('legal.termsOfUse.updated')}
      intro={t('legal.termsOfUse.intro')}
      sections={sections}
      onPressBack={() => router.back()}
    />
  );
}
