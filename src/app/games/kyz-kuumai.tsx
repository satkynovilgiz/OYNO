import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GameDetailScreen, type GameDetailDifficulty } from '@/features/games/GameDetailScreen';
import { KyzKuumaiGame } from '@/games3d/games/kyz-kuumai/KyzKuumaiGame';

const TUTORIAL_STEPS = ['games3d.kyzKuumai.tutorial1', 'games3d.kyzKuumai.tutorial2', 'games3d.kyzKuumai.tutorial3'];

export default function KyzKuumaiRoute() {
  const { t } = useTranslation();
  const [started, setStarted] = useState(false);
  const [difficulty, setDifficulty] = useState<GameDetailDifficulty>('normal');

  if (!started) {
    return (
      <GameDetailScreen
        gameId="kyz_kuumai"
        title={t('games3d.titles.kyzKuumai')}
        description={t('games3d.kyzKuumai.aboutDescription')}
        objective={t('games3d.kyzKuumai.aboutObjective')}
        tutorialStepKeys={TUTORIAL_STEPS}
        difficultyOptions={['easy', 'normal', 'hard']}
        difficulty={difficulty}
        onChangeDifficulty={setDifficulty}
        // No single higher-is-better score exists for a time-based chase -
        // see KyzKuumaiGame.tsx's own comment on why (games played only).
        cultureRoute="/culture/horse"
        onPressPractice={() => setStarted(true)}
        onPressPlay={() => setStarted(true)}
      />
    );
  }

  return <KyzKuumaiGame difficulty={difficulty} />;
}
