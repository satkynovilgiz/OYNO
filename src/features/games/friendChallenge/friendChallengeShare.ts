import * as Linking from 'expo-linking';

import type { ShareCardContent } from '@/components/share/ShareCard';
import { colors } from '@/theme';

import { gameArt } from '../gamesCatalog';
import { challengePath, type FriendChallenge } from './friendChallenge';

/** The app's own scheme link to the game's existing route (no website is
 * implied - Universal Links aren't configured). */
export function challengeLink(challenge: FriendChallenge): string | null {
  const path = challengePath(challenge);
  return path ? Linking.createURL(path.path, { queryParams: path.query }) : null;
}

/** Game art, the localized game name, "Can you beat 24?" and OYNO
 * branding - nothing about the sender. */
export function buildFriendChallengeCard(input: { gameName: string; prompt: string; listId: string }): ShareCardContent {
  return { title: input.gameName, label: input.prompt, imageSource: gameArt({ id: input.listId }, 'large'), fallbackTone: colors.primary };
}
