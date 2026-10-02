import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useShareCard } from '@/services/share/useShareCard';

import { track } from '@/services/analytics/analytics';

import { beatsTarget, challengeFromSession, type FriendChallenge } from '../friendChallenge/friendChallenge';
import { buildFriendChallengeCard, challengeLink } from '../friendChallenge/friendChallengeShare';
import { gameTitleKey } from '../types';
import { formatMetric, ruleFor, type GameSessionRecord } from './gameRecords';
import { buildPersonalBestShareCard } from './gameRecordsShare';
import { recordGameSession } from './useGameRecords';

/** For a game's RESULT phase: records the round once and exposes the
 * ResultScreen `personalBest` prop (with sharing). */
export type ResultFriendChallenge = {
  /** Set when this round was played against a friend's target. */
  outcome: { beaten: boolean; scoreText: string; targetText: string } | null;
  /** Set when this finished round can become a challenge to send. */
  onChallengeFriend: (() => void) | null;
};

export function useRoundRecords(
  gameId: string,
  challenge: FriendChallenge | null = null,
): {
  recordRound: (input: Omit<GameSessionRecord, 'id' | 'gameId' | 'completedAt'>) => void;
  personalBest: { value: string; previous: string; onShare: () => void } | null;
  friendChallenge: ResultFriendChallenge;
  /** The best after this round (formatted), for a "Personal best" stat. */
  bestText: string | null;
  clear: () => void;
  shareHost: ReactNode;
} {
  const { t } = useTranslation();
  const { share, shareHost } = useShareCard();
  const [newBest, setNewBest] = useState<{ value: number; previous: number } | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [lastRound, setLastRound] = useState<GameSessionRecord | null>(null);
  const rule = ruleFor(gameId);

  const recordRound = useCallback(
    (input: Omit<GameSessionRecord, 'id' | 'gameId' | 'completedAt'>) => {
      // The round is recorded through the normal rules (a friend challenge
      // never touches the personal best itself).
      setLastRound({ ...input, gameId, id: 'last', completedAt: '' });
      if (challenge && !input.practice) track('friend_challenge_completed', { game_id: gameId, metric_type: challenge.metric });
      void recordGameSession(gameId, input).then((outcome) => {
        setBest(outcome.best);
        setNewBest(outcome.isNewBest && outcome.previousBest !== null && outcome.best !== null ? { value: outcome.best, previous: outcome.previousBest } : null);
      });
    },
    [gameId, challenge],
  );
  const clear = useCallback(() => {
    setNewBest(null);
    setLastRound(null);
  }, []);

  const gameNameFor = (listId: string) => t(gameTitleKey(listId));
  const sendable = lastRound ? challengeFromSession(lastRound) : null;
  const friendChallenge: ResultFriendChallenge = {
    outcome:
      rule && challenge && lastRound && !lastRound.practice
        ? { beaten: beatsTarget(challenge, lastRound), scoreText: formatMetric(rule.primary.unit, lastRound.primary, t), targetText: formatMetric(rule.primary.unit, challenge.target, t) }
        : null,
    onChallengeFriend:
      rule && sendable
        ? () => {
            const link = challengeLink(sendable);
            if (!link) return;
            const gameName = gameNameFor(rule.listId);
            const target = formatMetric(rule.primary.unit, sendable.target, t);
            track('friend_challenge_shared', { game_id: rule.gameId, metric_type: sendable.metric });
            void share(buildFriendChallengeCard({ gameName, prompt: t('friendChallenge.canYouBeat', { target }), listId: rule.listId }), t('friendChallenge.shareMessage', { game: gameName, target, link }));
          }
        : null,
  };

  const bestText = rule && best !== null ? formatMetric(rule.primary.unit, best, t) : null;
  if (!rule || !newBest) return { recordRound, personalBest: null, friendChallenge, bestText, clear, shareHost };
  const value = formatMetric(rule.primary.unit, newBest.value, t);
  const gameName = t(gameTitleKey(rule.listId));
  return {
    recordRound,
    clear,
    shareHost,
    bestText,
    friendChallenge,
    personalBest: {
      value,
      previous: formatMetric(rule.primary.unit, newBest.previous, t),
      onShare: () =>
        void share(buildPersonalBestShareCard({ gameName, valueText: value, personalBestLabel: t('gameRecords.personalBest'), listId: rule.listId }), t('gameRecords.shareMessage', { game: gameName, value })),
    },
  };
}
