import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GameDetailScreen, type GameDetailDifficulty } from '@/features/games/GameDetailScreen';
import { JaaAtuuGame } from '@/games3d/games/jaa-atuu/JaaAtuuGame';
import type { JaaAtuuMode } from '@/games3d/games/jaa-atuu/JaaAtuuTypes';

const TUTORIAL_STEPS = ['games3d.jaaAtuu.tutorial1', 'games3d.jaaAtuu.tutorial2', 'games3d.jaaAtuu.tutorial3'];

export default function JaaAtuuRoute() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<JaaAtuuMode | null>(null);
  const [difficulty, setDifficulty] = useState<GameDetailDifficulty>('normal');

  if (!mode) {
    return (
      <GameDetailScreen
        gameId="jaa_atuu"
        title={t('games3d.titles.jaaAtuu')}
        description={t('games3d.jaaAtuu.aboutDescription')}
        objective={t('games3d.jaaAtuu.aboutObjective')}
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

  return <JaaAtuuGame mode={mode} difficulty={difficulty} />;
}
