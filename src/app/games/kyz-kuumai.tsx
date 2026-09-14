import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GameDetailScreen, type GameDetailDifficulty } from '@/features/games/GameDetailScreen';
import { KyzKuumaiGame } from '@/games3d/games/kyz-kuumai/KyzKuumaiGame';
import type { KyzKuumaiMode } from '@/games3d/games/kyz-kuumai/KyzKuumaiTypes';

const TUTORIAL_STEPS = ['games3d.kyzKuumai.tutorial1', 'games3d.kyzKuumai.tutorial2', 'games3d.kyzKuumai.tutorial3'];

export default function KyzKuumaiRoute() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<KyzKuumaiMode | null>(null);
  const [difficulty, setDifficulty] = useState<GameDetailDifficulty>('normal');

  if (!mode) {
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
        // Difficulty only affects the AI rival's speed, so it has no effect
        // in Practice (a solo checkpoint course, no AI at all) - shown
        // regardless since GameDetailScreen doesn't know which button will
        // be pressed, but the value is simply unused in that path.
        cultureRoute="/culture/horse"
        onPressPractice={() => setMode('practice')}
        onPressPlay={() => setMode('normal')}
      />
    );
  }

  return <KyzKuumaiGame difficulty={difficulty} mode={mode} />;
}
