import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values.',
  );
}

/**
 * The anon/publishable key is safe to ship in the client by design - it is
 * meaningless without Row Level Security, which is why every table this
 * app reads/writes must have RLS enabled (see BACKEND_PLAN.md §5). Never
 * add the service_role key here or anywhere the mobile app reads from.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Signup/reset verification uses typed OTP codes entered in-app
    // (SupabaseAuthService.verifyEmail/verifyPasswordResetCode), not
    // links - there's no auth URL for this client to ever detect.
    detectSessionInUrl: false,
    // SupabaseAuthService.signInWithOAuth reads a `?code=` param from the
    // redirect and calls exchangeCodeForSession() - that's the PKCE flow.
    // Without this, the client defaults to 'implicit' and Supabase
    // returns tokens in a #access_token= hash fragment instead, which the
    // callback parsing never matches.
    flowType: 'pkce',
  },
});

// supabase-js's autoRefreshToken only ticks while something calls
// startAutoRefresh/stopAutoRefresh around app foreground/background -
// this is the standard Expo+Supabase wiring for that.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});

let confirmationClients = 0;

/**
 * A short-lived, IN-MEMORY Supabase client for confirming a sensitive
 * action (account deletion). Signing in on it never touches the app's own
 * session: no shared storage, no auth events on `supabase`, no token
 * refresh. So a wrong-account sign-in during confirmation can't be picked
 * up by sync, guest adoption or any private-data write, which all use
 * `supabase`. PKCE state lives in this client's own memory only.
 */
export function createConfirmationClient() {
  const memory = new Map<string, string>();
  confirmationClients += 1;
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      storage: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => void memory.set(key, value),
        removeItem: (key: string) => void memory.delete(key),
      },
      storageKey: `oyno-confirm-${confirmationClients}`,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
}

export type ConfirmationClient = ReturnType<typeof createConfirmationClient>;
