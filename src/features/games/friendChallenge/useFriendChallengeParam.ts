import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';

import { track } from '@/services/analytics/analytics';

import { parseChallenge, type FriendChallenge } from './friendChallenge';

/** The (untrusted) challenge in the current game URL: a valid challenge,
 * or `invalid` when the link carried challenge params that didn't pass
 * validation (the game then opens normally). */
export function useFriendChallengeParam(gameId: string): { challenge: FriendChallenge | null; invalid: boolean } {
  const params = useLocalSearchParams<{ challengeMetric?: string; target?: string }>();
  const challenge = useMemo(() => parseChallenge(gameId, params), [gameId, params.challengeMetric, params.target]); // eslint-disable-line react-hooks/exhaustive-deps
  const invalid = !challenge && (params.challengeMetric !== undefined || params.target !== undefined);
  useEffect(() => {
    if (challenge) track('friend_challenge_opened', { game_id: challenge.gameId, metric_type: challenge.metric });
  }, [challenge?.gameId, challenge?.metric, challenge?.target]); // eslint-disable-line react-hooks/exhaustive-deps
  return { challenge, invalid };
}
