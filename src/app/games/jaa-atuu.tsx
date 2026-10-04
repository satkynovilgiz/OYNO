import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import jaaAtuuThumbnail from '@assets/img/games/zhaaAtuu/thumbnail.png';

import { useFriendChallengeParam } from '@/features/games/friendChallenge/useFriendChallengeParam';
import { GameDetailScreen, type GameDetailDifficulty } from '@/features/games/GameDetailScreen';
import { JaaAtuuGame } from '@/games3d/games/jaa-atuu/JaaAtuuGame';
import type { JaaAtuuMode } from '@/games3d/games/jaa-atuu/JaaAtuuTypes';
import { favoriteKey, useFavoritesStore } from '@/store/useFavoritesStore';
import { toggleFavoriteWithFeedback } from '@/features/saved/toggleFavoriteWithFeedback';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

const TUTORIAL_STEPS = ['games3d.jaaAtuu.tutorial1', 'games3d.jaaAtuu.tutorial2', 'games3d.jaaAtuu.tutorial3'];
// mockGamesList's id for this game (kebab-case, different romanization
// than the games3d registry's own `jaa_atuu`) - favoriting must key off
// this one so it lines up with the Search/Saved catalog, which is built
// from mockGamesList.
const FAVORITE_GAME_ID = 'zhaa-atuu';

export default function JaaAtuuRoute() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<JaaAtuuMode | null>(null);
  // Practice Academy: the chosen goal (null = Free Practice); returning to
  // Game Detail with the picker open for "Choose another goal".
  const [missionId, setMissionId] = useState<string | null>(null);
  const [reopenPicker, setReopenPicker] = useState(false);
  // A friend's challenge from a link (validated; anonymous; normal mode only).
  const { challenge, invalid } = useFriendChallengeParam('jaa_atuu');
  const [withChallenge, setWithChallenge] = useState(false);
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
        cultureRoute="/culture/games"
        isFavorite={isFavorite}
        onToggleFavorite={() => void toggleFavoriteWithFeedback('game', FAVORITE_GAME_ID)}
        onPressPractice={(nextMission) => {
          setMissionId(nextMission ?? null);
          setReopenPicker(false);
          setMode('practice');
        }}
        openPracticePicker={reopenPicker}
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

  return (
    <JaaAtuuGame
      mode={mode}
      difficulty={difficulty}
      challenge={withChallenge ? challenge : null}
      practiceMissionId={missionId}
      onChooseAnotherGoal={() => {
        setReopenPicker(true);
        setMode(null);
      }}
    />
  );
}
