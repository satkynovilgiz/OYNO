import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GameDetailScreen, type GameDetailDifficulty } from '@/features/games/GameDetailScreen';
import { OrdoGame } from '@/games3d/games/ordo/OrdoGame';

const TUTORIAL_STEPS = ['games3d.ordo.tutorial1', 'games3d.ordo.tutorial2', 'games3d.ordo.tutorial3'];

export default function OrdoRoute() {
  const { t } = useTranslation();
  const [started, setStarted] = useState(false);
  const [difficulty, setDifficulty] = useState<GameDetailDifficulty>('normal');

  if (!started) {
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
        // No practice-vs-play behavior split exists yet for Ordo (only Jaa
        // Atuu has one so far - see docs/3D_GAMES.md) - both buttons start
        // the same match.
        onPressPractice={() => setStarted(true)}
        onPressPlay={() => setStarted(true)}
      />
    );
  }

  return <OrdoGame difficulty={difficulty} />;
}
