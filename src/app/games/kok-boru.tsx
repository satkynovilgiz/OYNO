import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GameDetailScreen } from '@/features/games/GameDetailScreen';
import { KokBoruGame } from '@/games3d/games/kok-boru/KokBoruGame';
import type { KokBoruMode } from '@/games3d/games/kok-boru/KokBoruTypes';
import { favoriteKey, useFavoritesStore } from '@/store/useFavoritesStore';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

const TUTORIAL_STEPS = ['games3d.kokBoru.tutorial1', 'games3d.kokBoru.tutorial2', 'games3d.kokBoru.tutorial3'];

export default function KokBoruRoute() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<KokBoruMode | null>(null);
  const isFavorite = useFavoritesStore((state) => state.favoriteIds.includes(favoriteKey('game', 'kok-boru')));

  if (!mode) {
    return (
      <GameDetailScreen
        gameId="kok_boru"
        title={t('games3d.titles.kokBoru')}
        description={t('games3d.kokBoru.aboutDescription')}
        objective={t('games3d.kokBoru.aboutObjective')}
        tutorialStepKeys={TUTORIAL_STEPS}
        // No difficulty presets exist for Kok Boru yet (Phase A: no AI
        // opponent at all - see KokBoruTypes.ts), so no picker is shown.
        culturalContextItemId="horse-kok-boru"
        cultureRoute="/culture/horse"
        isFavorite={isFavorite}
        onToggleFavorite={() => void useFavoritesStore.getState().toggleFavorite('game', 'kok-boru')}
        onPressPractice={() => setMode('practice')}
        onPressPlay={() => setMode('normal')}
      />
    );
  }

  return <KokBoruGame mode={mode} />;
}
