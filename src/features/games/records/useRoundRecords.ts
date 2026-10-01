import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useShareCard } from '@/services/share/useShareCard';

import { gameTitleKey } from '../types';
import { formatMetric, ruleFor, type GameSessionRecord } from './gameRecords';
import { buildPersonalBestShareCard } from './gameRecordsShare';
import { recordGameSession } from './useGameRecords';

/** For a game's RESULT phase: records the round once and exposes the
 * ResultScreen `personalBest` prop (with sharing). */
export function useRoundRecords(gameId: string): {
  recordRound: (input: Omit<GameSessionRecord, 'id' | 'gameId' | 'completedAt'>) => void;
  personalBest: { value: string; previous: string; onShare: () => void } | null;
  /** The best after this round (formatted), for a "Personal best" stat. */
  bestText: string | null;
  clear: () => void;
  shareHost: ReactNode;
} {
  const { t } = useTranslation();
  const { share, shareHost } = useShareCard();
  const [newBest, setNewBest] = useState<{ value: number; previous: number } | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const rule = ruleFor(gameId);

  const recordRound = useCallback(
    (input: Omit<GameSessionRecord, 'id' | 'gameId' | 'completedAt'>) => {
      void recordGameSession(gameId, input).then((outcome) => {
        setBest(outcome.best);
        setNewBest(outcome.isNewBest && outcome.previousBest !== null && outcome.best !== null ? { value: outcome.best, previous: outcome.previousBest } : null);
      });
    },
    [gameId],
  );
  const clear = useCallback(() => setNewBest(null), []);

  const bestText = rule && best !== null ? formatMetric(rule.primary.unit, best, t) : null;
  if (!rule || !newBest) return { recordRound, personalBest: null, bestText, clear, shareHost };
  const value = formatMetric(rule.primary.unit, newBest.value, t);
  const gameName = t(gameTitleKey(rule.listId));
  return {
    recordRound,
    clear,
    shareHost,
    bestText,
    personalBest: {
      value,
      previous: formatMetric(rule.primary.unit, newBest.previous, t),
      onShare: () =>
        void share(buildPersonalBestShareCard({ gameName, valueText: value, personalBestLabel: t('gameRecords.personalBest'), listId: rule.listId }), t('gameRecords.shareMessage', { game: gameName, value })),
    },
  };
}
