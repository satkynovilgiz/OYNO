import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import {
  AuthError,
  authService,
  type AuthUser,
  type OAuthProvider,
  type SignInInput,
  type SignUpInput,
  type SignUpResult,
} from '@/services/auth';
import { track } from '@/services/analytics/analytics';
import { localizeAuthError } from '@/services/auth/authErrors';
import { isOfflineNow } from '@/services/offline/networkStatus';
import { supabase } from '@/services/supabase/client';

/** "guest" = explored without an account (spec: guests can browse/play
 * single-player; progress isn't saved - see the guest hints already wired
 * into CharacterSelectScreen/TodayDiscoveryCard). Persisted separately from
 * a real session so a returning guest skips onboarding but isn't mistaken
 * for a signed-in user. */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'guest';

const GUEST_MODE_KEY = 'oyno.auth.guestMode';

/**
 * Account-state hooks, registered by the sync layer
 * (services/sync/accountLifecycle.ts) - kept as a registration seam so
 * this store doesn't import every other store. `beforeSignOut` runs while
 * the session still exists (a last sync), then clears the account's local
 * state so the next person on the device never sees it.
 */
export type AccountHooks = {
  beforeSignOut?: (userId: string) => Promise<void>;
  afterAccountDeleted?: (userId: string) => Promise<void>;
  afterSessionLost?: (userId: string) => Promise<void>;
};

let accountHooks: AccountHooks = {};
let signingOut = false;

export function registerAccountHooks(hooks: AccountHooks): void {
  accountHooks = hooks;
}

/** Known-offline: fail fast with a clear message instead of a request
 * that can only spin and time out. Unknown connectivity counts as online. */
function offlineMessage(): string | null {
  return isOfflineNow() ? localizeAuthError(new AuthError('network-error', '')) : null;
}

type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  isSubmitting: boolean;
  error: string | null;
  /** Reads any existing local session (or guest flag) on app start. Call
   * once from the Splash screen before deciding where to route. */
  initialize: () => Promise<void>;
  /** `false` on failure (error already set); otherwise the real result -
   * the caller routes to /verify-email or /home based on which it is. */
  signUp: (input: SignUpInput) => Promise<SignUpResult | false>;
  signIn: (input: SignInInput) => Promise<boolean>;
  /** 'cancelled' when the user closed the provider sheet without finishing -
   * not an error, the caller should just do nothing. Otherwise the caller
   * routes to /profile-setup ('new-user') or /home ('signed-in'). */
  signInWithOAuth: (provider: OAuthProvider) => Promise<'new-user' | 'signed-in' | 'cancelled' | false>;
  signOut: () => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<boolean>;
  resendVerificationEmail: (email: string) => Promise<boolean>;
  deleteAccount: (password: string) => Promise<boolean>;
  continueAsGuest: () => Promise<void>;
  updateProfile: (input: { name?: string; email?: string }) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  clearError: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  isSubmitting: false,
  error: null,

  initialize: async () => {
    // Falls back to 'unauthenticated' (not 'loading') on any failure here -
    // status must never get stuck at 'loading' forever, since RouteGuard
    // and the Splash gate both wait on it before routing anywhere. Worst
    // case the user has to sign in again; best case nothing was wrong.
    try {
      const session = await authService.getSession();
      if (session) {
        set({ status: 'authenticated', user: session.user });
        return;
      }
      const isGuest = (await AsyncStorage.getItem(GUEST_MODE_KEY).catch(() => null)) === 'true';
      set({ status: isGuest ? 'guest' : 'unauthenticated', user: null });
    } catch {
      set({ status: 'unauthenticated', user: null });
    }
  },

  continueAsGuest: async () => {
    await AsyncStorage.setItem(GUEST_MODE_KEY, 'true');
    set({ status: 'guest', user: null });
  },

  signUp: async (input) => {
    // A second tap while the first request runs is ignored.
    if (get().isSubmitting) return false;
    const offline = offlineMessage();
    if (offline) {
      set({ error: offline });
      return false;
    }
    set({ isSubmitting: true, error: null });
    try {
      const result = await authService.signUp(input);
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      if (result.status === 'signed-in') {
        set({ status: 'authenticated', user: result.session.user, isSubmitting: false });
        track('sign_up');
      } else {
        set({ isSubmitting: false });
      }
      return result;
    } catch (error) {
      set({ isSubmitting: false, error: localizeAuthError(error, 'signUp') });
      return false;
    }
  },

  signIn: async (input) => {
    // A second tap while the first request runs is ignored.
    if (get().isSubmitting) return false;
    const offline = offlineMessage();
    if (offline) {
      set({ error: offline });
      return false;
    }
    set({ isSubmitting: true, error: null });
    try {
      const session = await authService.signIn(input);
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      set({ status: 'authenticated', user: session.user, isSubmitting: false });
      track('sign_in');
      return true;
    } catch (error) {
      set({ isSubmitting: false, error: localizeAuthError(error, 'signIn') });
      return false;
    }
  },

  signInWithOAuth: async (provider) => {
    const offline = offlineMessage();
    if (offline) {
      set({ error: offline });
      return false;
    }
    set({ isSubmitting: true, error: null });
    try {
      const { session, isNewUser } = await authService.signInWithOAuth(provider);
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      set({ status: 'authenticated', user: session.user, isSubmitting: false });
      track(isNewUser ? 'sign_up' : 'sign_in');
      return isNewUser ? 'new-user' : 'signed-in';
    } catch (error) {
      if (error instanceof AuthError && error.code === 'cancelled') {
        set({ isSubmitting: false });
        return 'cancelled';
      }
      set({ isSubmitting: false, error: localizeAuthError(error, 'signIn') });
      return false;
    }
  },

  signOut: async () => {
    const userId = get().user?.id;
    signingOut = true;
    try {
      if (userId) await accountHooks.beforeSignOut?.(userId).catch(() => {});
      await authService.signOut();
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      set({ status: 'unauthenticated', user: null });
    } finally {
      signingOut = false;
    }
  },

  verifyEmail: async (email, code) => {
    // A second tap while the first request runs is ignored.
    if (get().isSubmitting) return false;
    const offline = offlineMessage();
    if (offline) {
      set({ error: offline });
      return false;
    }
    set({ isSubmitting: true, error: null });
    try {
      const session = await authService.verifyEmail(email, code);
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      set({ status: 'authenticated', user: session.user, isSubmitting: false });
      track('sign_up');
      return true;
    } catch (error) {
      set({ isSubmitting: false, error: localizeAuthError(error, 'verify') });
      return false;
    }
  },

  resendVerificationEmail: async (email) => {
    const offline = offlineMessage();
    if (offline) {
      set({ error: offline });
      return false;
    }
    set({ error: null });
    try {
      await authService.resendVerificationEmail(email);
      return true;
    } catch (error) {
      set({ error: localizeAuthError(error, 'verify') });
      return false;
    }
  },

  deleteAccount: async (password) => {
    set({ isSubmitting: true, error: null });
    try {
      const userId = get().user?.id;
      await authService.deleteAccount(password);
      if (userId) await accountHooks.afterAccountDeleted?.(userId).catch(() => {});
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      set({ status: 'unauthenticated', user: null, isSubmitting: false });
      return true;
    } catch (error) {
      set({ isSubmitting: false, error: localizeAuthError(error, 'account') });
      return false;
    }
  },

  updateProfile: async (input) => {
    set({ isSubmitting: true, error: null });
    try {
      const session = await authService.updateProfile(input);
      set({ user: session.user, isSubmitting: false });
      track('profile_updated');
      return true;
    } catch (error) {
      set({ isSubmitting: false, error: localizeAuthError(error, 'account') });
      return false;
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    set({ isSubmitting: true, error: null });
    try {
      await authService.changePassword(currentPassword, newPassword);
      set({ isSubmitting: false });
      return true;
    } catch (error) {
      set({ isSubmitting: false, error: localizeAuthError(error, 'account') });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));

// Keeps `status` in sync with the *real* underlying Supabase session,
// regardless of which code path changed it. Found via live testing:
// confirmPasswordReset() signs out directly through the Supabase client
// (by design - see its doc comment) without going through this store, so
// without this listener the store kept reporting 'authenticated' with a
// stale user after a password reset, and RouteGuard sent the user to
// /home instead of /sign-in with a session that no longer actually
// existed. Scoped to SIGNED_OUT only - sign-in/signup paths already set
// `user` themselves with the profile-joined AuthUser this event's bare
// Session doesn't carry.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    const { status, user } = useAuthStore.getState();
    // Our own signOut() already cleaned up; this is the session ending
    // underneath the app (password reset elsewhere, expired refresh token).
    if (status === 'authenticated' && !signingOut && user?.id) void accountHooks.afterSessionLost?.(user.id).catch(() => {});
    useAuthStore.setState((state) => (state.status === 'authenticated' ? { status: 'unauthenticated', user: null } : {}));
  }
});
