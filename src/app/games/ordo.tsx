import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GameDetailScreen, type GameDetailDifficulty } from '@/features/games/GameDetailScreen';
import { OrdoGame } from '@/games3d/games/ordo/OrdoGame';
import type { OrdoMode } from '@/games3d/games/ordo/OrdoTypes';

const TUTORIAL_STEPS = ['games3d.ordo.tutorial1', 'games3d.ordo.tutorial2', 'games3d.ordo.tutorial3'];

export default function OrdoRoute() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<OrdoMode | null>(null);
  const [difficulty, setDifficulty] = useState<GameDetailDifficulty>('normal');

  if (!mode) {
    return (
      <GameDetailScreen
        gameId="ordo"
        title={t('games3d.titles.ordo')}
        description={t('games3d.ordo.aboutDescription')}
        objective={t('games3d.ordo.aboutObjective')}
        tutorialStepKeys={TUTORIAL_STEPS}
        difficultyOptions={['easy', 'normal', 'hard']}
        difficulty={difficulty}
        onChangeDifficulty={setDifficulty}
        showBestScore
        cultureRoute="/culture/games"
        onPressPractice={() => setMode('practice')}
        onPressPlay={() => setMode('normal')}
      />
    );
  }

  return <OrdoGame difficulty={difficulty} mode={mode} />;
}
