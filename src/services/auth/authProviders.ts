import { useQuery } from '@tanstack/react-query';

import type { OAuthProvider } from './types';

/**
 * Which social sign-in providers are actually switched on for this
 * Supabase project - read from Auth's public settings endpoint (the same
 * public anon key the client already uses; returns only on/off flags).
 * Buttons for a provider are shown only when it is enabled, so no one
 * taps "Continue with Google" into a provider error. Unknown (offline,
 * request failed) = none shown; email sign-in always works.
 */
const PROVIDERS: OAuthProvider[] = ['apple', 'google'];

export function parseEnabledProviders(settings: unknown): OAuthProvider[] {
  const external = (settings as { external?: Record<string, unknown> } | null)?.external;
  if (!external || typeof external !== 'object') return [];
  return PROVIDERS.filter((provider) => external[provider] === true);
}

async function fetchEnabledProviders(): Promise<OAuthProvider[]> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
  if (!response.ok) return [];
  return parseEnabledProviders(await response.json());
}

export function useEnabledOAuthProviders(): OAuthProvider[] {
  const { data } = useQuery({ queryKey: ['auth', 'enabled-providers'], queryFn: fetchEnabledProviders, staleTime: 60 * 60 * 1000, retry: 1 });
  return data ?? [];
}
