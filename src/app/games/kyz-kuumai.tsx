import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import kyzKuumaiThumbnail from '@assets/img/games/kyzKuumay/thumbnail.png';

import { GameDetailScreen, type GameDetailDifficulty } from '@/features/games/GameDetailScreen';
import { KyzKuumaiGame } from '@/games3d/games/kyz-kuumai/KyzKuumaiGame';
import type { KyzKuumaiMode } from '@/games3d/games/kyz-kuumai/KyzKuumaiTypes';
import { favoriteKey, useFavoritesStore } from '@/store/useFavoritesStore';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

const TUTORIAL_STEPS = ['games3d.kyzKuumai.tutorial1', 'games3d.kyzKuumai.tutorial2', 'games3d.kyzKuumai.tutorial3'];
// mockGamesList's id (differs in spelling from the games3d registry's own
// `kyz_kuumai`) - favoriting keys off this one so it lines up with the
// Search/Saved catalog.
const FAVORITE_GAME_ID = 'kyz-kuumay';

export default function KyzKuumaiRoute() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<KyzKuumaiMode | null>(null);
  const [difficulty, setDifficulty] = useState<GameDetailDifficulty>('normal');
  const isFavorite = useFavoritesStore((state) => state.favoriteIds.includes(favoriteKey('game', FAVORITE_GAME_ID)));

  if (!mode) {
    return (
      <GameDetailScreen
        gameId="kyz_kuumai"
        title={t('games3d.titles.kyzKuumai')}
        description={t('games3d.kyzKuumai.aboutDescription')}
        objective={t('games3d.kyzKuumai.aboutObjective')}
        tutorialStepKeys={TUTORIAL_STEPS}
        imageSource={kyzKuumaiThumbnail}
        difficultyOptions={['easy', 'normal', 'hard']}
        difficulty={difficulty}
        onChangeDifficulty={setDifficulty}
        // Difficulty only affects the AI rival's speed, so it has no effect
        // in Practice (a solo checkpoint course, no AI at all) - shown
        // regardless since GameDetailScreen doesn't know which button will
        // be pressed, but the value is simply unused in that path.
        culturalContextItemId="horse-kyz-kuumai"
        cultureRoute="/culture/horse"
        isFavorite={isFavorite}
        onToggleFavorite={() => void useFavoritesStore.getState().toggleFavorite('game', FAVORITE_GAME_ID)}
        onPressPractice={() => setMode('practice')}
        onPressPlay={() => setMode('normal')}
      />
    );
  }

  return <KyzKuumaiGame difficulty={difficulty} mode={mode} />;
}
