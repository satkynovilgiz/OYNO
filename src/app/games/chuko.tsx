import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GameDetailScreen, type GameDetailDifficulty } from '@/features/games/GameDetailScreen';
import { ChukoGame } from '@/games3d/games/chuko/ChukoGame';

const TUTORIAL_STEPS = ['games3d.chuko.tutorial1', 'games3d.chuko.tutorial2', 'games3d.chuko.tutorial3'];

export default function ChukoRoute() {
  const { t } = useTranslation();
  const [started, setStarted] = useState(false);
  const [difficulty, setDifficulty] = useState<GameDetailDifficulty>('normal');

  if (!started) {
    return (
      <GameDetailScreen
        gameId="chuko"
        title={t('games3d.titles.chuko')}
        description={t('games3d.chuko.aboutDescription')}
        objective={t('games3d.chuko.aboutObjective')}
        tutorialStepKeys={TUTORIAL_STEPS}
        difficultyOptions={['easy', 'normal', 'hard']}
        difficulty={difficulty}
        onChangeDifficulty={setDifficulty}
        showBestScore
        cultureRoute="/culture/games"
        // No practice-vs-play behavior split exists yet for Chuko (only
        // Jaa Atuu has one so far) - both buttons start the same match.
        onPressPractice={() => setStarted(true)}
        onPressPlay={() => setStarted(true)}
      />
    );
  }

  return <ChukoGame difficulty={difficulty} />;
}
