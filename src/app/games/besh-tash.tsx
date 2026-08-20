import { router } from 'expo-router';
import { useState } from 'react';

import { GameIntroScreen } from '@/components/character';
import { BeshTashScreen } from '@games/beshTash/screens/BeshTashScreen';

export default function BeshTashRoute() {
  const [introDone, setIntroDone] = useState(false);

  if (!introDone) {
    return (
      <GameIntroScreen
        gameId="besh-tash"
        howToPlayText="Бир колуң менен гана ойно: ташты ыргытып, түшкөнчө жерден башка ташты ала кой."
        onFinish={() => setIntroDone(true)}
      />
    );
  }

  return <BeshTashScreen onPressBack={() => router.back()} />;
}
