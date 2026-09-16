import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import chukoThumbnail from '@assets/img/games/chuko/thumbnail.png';

import { GameDetailScreen, type GameDetailDifficulty } from '@/features/games/GameDetailScreen';
import { ChukoGame } from '@/games3d/games/chuko/ChukoGame';
import type { ChukoMode } from '@/games3d/games/chuko/ChukoTypes';

const TUTORIAL_STEPS = ['games3d.chuko.tutorial1', 'games3d.chuko.tutorial2', 'games3d.chuko.tutorial3', 'games3d.chuko.tutorial4'];

export default function ChukoRoute() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ChukoMode | null>(null);
  const [difficulty, setDifficulty] = useState<GameDetailDifficulty>('normal');

  if (!mode) {
    return (
      <GameDetailScreen
        gameId="chuko"
        title={t('games3d.titles.chuko')}
        description={t('games3d.chuko.aboutDescription')}
        objective={t('games3d.chuko.aboutObjective')}
        tutorialStepKeys={TUTORIAL_STEPS}
        imageSource={chukoThumbnail}
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

  return <ChukoGame difficulty={difficulty} mode={mode} />;
}
