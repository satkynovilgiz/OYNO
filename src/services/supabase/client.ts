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
    // Signup/reset links are handled manually via two dedicated Expo
    // Router routes (auth-callback-signup.tsx, auth-callback-recovery.tsx)
    // that call exchangeCodeForSession explicitly, not supabase-js's own
    // automatic URL-based detection (a web-browser-oriented feature that
    // doesn't map cleanly onto React Native navigation).
    detectSessionInUrl: false,
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
