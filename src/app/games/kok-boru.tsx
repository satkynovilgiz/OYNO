import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GameDetailScreen } from '@/features/games/GameDetailScreen';
import { KokBoruGame } from '@/games3d/games/kok-boru/KokBoruGame';

const TUTORIAL_STEPS = ['games3d.kokBoru.tutorial1', 'games3d.kokBoru.tutorial2', 'games3d.kokBoru.tutorial3'];

export default function KokBoruRoute() {
  const { t } = useTranslation();
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <GameDetailScreen
        gameId="kok_boru"
        title={t('games3d.titles.kokBoru')}
        description={t('games3d.kokBoru.aboutDescription')}
        objective={t('games3d.kokBoru.aboutObjective')}
        tutorialStepKeys={TUTORIAL_STEPS}
        // No difficulty presets exist for Kok Boru yet (Phase A: no AI
        // opponent at all - see KokBoruTypes.ts), so no picker is shown.
        cultureRoute="/culture/horse"
        onPressPractice={() => setStarted(true)}
        onPressPlay={() => setStarted(true)}
      />
    );
  }

  return <KokBoruGame />;
}
