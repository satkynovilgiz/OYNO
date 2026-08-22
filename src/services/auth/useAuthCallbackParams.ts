import * as ExpoLinking from 'expo-linking';
import { Platform } from 'react-native';

export type AuthCallbackParams = {
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  errorDescription?: string;
};

function extractFromUrl(url: string): AuthCallbackParams {
  const [beforeHash, hash] = url.split('#');
  const queryString = beforeHash.includes('?') ? beforeHash.split('?').slice(1).join('?') : '';
  const query = new URLSearchParams(queryString);
  const frag = new URLSearchParams(hash ?? '');
  return {
    code: query.get('code') ?? frag.get('code') ?? undefined,
    accessToken: frag.get('access_token') ?? query.get('access_token') ?? undefined,
    refreshToken: frag.get('refresh_token') ?? query.get('refresh_token') ?? undefined,
    errorDescription: frag.get('error_description') ?? query.get('error_description') ?? undefined,
  };
}

/**
 * Reads whichever URL actually opened the auth-callback screen and pulls
 * out Supabase's params, handling both flow types Supabase can be
 * configured with: a `code` query param (PKCE) or access_token/
 * refresh_token in the URL fragment (implicit - confirmed live against
 * this project's actual signup-confirmation email, which uses this one).
 * Which flow is active is a Supabase project setting this client doesn't
 * control, so it isn't assumed either way.
 *
 * Returns `null` only while still resolving (native cold-start - expo-
 * linking's URL isn't available synchronously on first render; web reads
 * `window.location` directly and is always synchronous).
 */
export function useAuthCallbackParams(): AuthCallbackParams | null {
  const linkingUrl = ExpoLinking.useURL();
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? extractFromUrl(window.location.href) : {};
  }
  if (linkingUrl === undefined) return null;
  return extractFromUrl(linkingUrl ?? '');
}
