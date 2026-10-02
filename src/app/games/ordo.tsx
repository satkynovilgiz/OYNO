import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import ordoThumbnail from '@assets/img/games/ordo/thumbnail.png';

import { useFriendChallengeParam } from '@/features/games/friendChallenge/useFriendChallengeParam';
import { GameDetailScreen, type GameDetailDifficulty } from '@/features/games/GameDetailScreen';
import { OrdoGame } from '@/games3d/games/ordo/OrdoGame';
import type { OrdoMode } from '@/games3d/games/ordo/OrdoTypes';
import { favoriteKey, useFavoritesStore } from '@/store/useFavoritesStore';
import { toggleFavoriteWithFeedback } from '@/features/saved/toggleFavoriteWithFeedback';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

const TUTORIAL_STEPS = ['games3d.ordo.tutorial1', 'games3d.ordo.tutorial2', 'games3d.ordo.tutorial3'];

export default function OrdoRoute() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<OrdoMode | null>(null);
  // A friend's challenge from a link (validated; anonymous; normal mode only).
  const { challenge, invalid } = useFriendChallengeParam('ordo');
  const [withChallenge, setWithChallenge] = useState(false);
  const [difficulty, setDifficulty] = useState<GameDetailDifficulty>('normal');
  const isFavorite = useFavoritesStore((state) => state.favoriteIds.includes(favoriteKey('game', 'ordo')));

  if (!mode) {
    return (
      <GameDetailScreen
        gameId="ordo"
        title={t('games3d.titles.ordo')}
        description={t('games3d.ordo.aboutDescription')}
        objective={t('games3d.ordo.aboutObjective')}
        tutorialStepKeys={TUTORIAL_STEPS}
        imageSource={ordoThumbnail}
        difficultyOptions={['easy', 'normal', 'hard']}
        difficulty={difficulty}
        onChangeDifficulty={setDifficulty}
        cultureRoute="/culture/games"
        isFavorite={isFavorite}
        onToggleFavorite={() => void toggleFavoriteWithFeedback('game', 'ordo')}
        onPressPractice={() => setMode('practice')}
        onPressPlay={() => {
          setWithChallenge(false);
          setMode('normal');
        }}
        friendChallenge={challenge}
        invalidChallenge={invalid}
        onPressPlayChallenge={() => {
          setWithChallenge(true);
          setMode('normal');
        }}
      />
    );
  }

  return <OrdoGame difficulty={difficulty} mode={mode} challenge={withChallenge ? challenge : null} />;
}
