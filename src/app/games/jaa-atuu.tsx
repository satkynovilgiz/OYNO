import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import jaaAtuuThumbnail from '@assets/img/games/zhaaAtuu/thumbnail.png';

import { GameDetailScreen, type GameDetailDifficulty } from '@/features/games/GameDetailScreen';
import { JaaAtuuGame } from '@/games3d/games/jaa-atuu/JaaAtuuGame';
import type { JaaAtuuMode } from '@/games3d/games/jaa-atuu/JaaAtuuTypes';
import { favoriteKey, useFavoritesStore } from '@/store/useFavoritesStore';

const TUTORIAL_STEPS = ['games3d.jaaAtuu.tutorial1', 'games3d.jaaAtuu.tutorial2', 'games3d.jaaAtuu.tutorial3'];
// mockGamesList's id for this game (kebab-case, different romanization
// than the games3d registry's own `jaa_atuu`) - favoriting must key off
// this one so it lines up with the Search/Saved catalog, which is built
// from mockGamesList.
const FAVORITE_GAME_ID = 'zhaa-atuu';

export default function JaaAtuuRoute() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<JaaAtuuMode | null>(null);
  const [difficulty, setDifficulty] = useState<GameDetailDifficulty>('normal');
  const isFavorite = useFavoritesStore((state) => state.favoriteIds.includes(favoriteKey('game', FAVORITE_GAME_ID)));

  if (!mode) {
    return (
      <GameDetailScreen
        gameId="jaa_atuu"
        title={t('games3d.titles.jaaAtuu')}
        description={t('games3d.jaaAtuu.aboutDescription')}
        objective={t('games3d.jaaAtuu.aboutObjective')}
        tutorialStepKeys={TUTORIAL_STEPS}
        imageSource={jaaAtuuThumbnail}
        difficultyOptions={['easy', 'normal', 'hard']}
        difficulty={difficulty}
        onChangeDifficulty={setDifficulty}
        showBestScore
        cultureRoute="/culture/games"
        isFavorite={isFavorite}
        onToggleFavorite={() => void useFavoritesStore.getState().toggleFavorite('game', FAVORITE_GAME_ID)}
        onPressPractice={() => setMode('practice')}
        onPressPlay={() => setMode('normal')}
      />
    );
  }

  return <JaaAtuuGame mode={mode} difficulty={difficulty} />;
}
