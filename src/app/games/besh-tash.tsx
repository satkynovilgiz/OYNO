import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GameIntroScreen } from '@/components/character';
import { BeshTashScreen } from '@games/beshTash/screens/BeshTashScreen';

export default function BeshTashRoute() {
  const { t } = useTranslation();
  const [introDone, setIntroDone] = useState(false);

  if (!introDone) {
    return (
      <GameIntroScreen
        gameId="besh-tash"
        howToPlayText={t('beshTash.howToPlayTip')}
        onFinish={() => setIntroDone(true)}
      />
    );
  }

  return <BeshTashScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/games'))} />;
}
