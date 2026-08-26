import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { LegalDocumentScreen } from '@/features/settings/LegalDocumentScreen';

type LegalSection = { heading: string; body: string };

export default function PrivacyPolicyRoute() {
  const { t } = useTranslation();
  const sections = t('legal.privacyPolicy.sections', { returnObjects: true }) as LegalSection[];

  return (
    <LegalDocumentScreen
      title={t('legal.privacyPolicy.title')}
      updated={t('legal.privacyPolicy.updated')}
      intro={t('legal.privacyPolicy.intro')}
      sections={sections}
      onPressBack={() => router.back()}
    />
  );
}
