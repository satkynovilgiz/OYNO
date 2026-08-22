import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import {
  AuthError,
  authService,
  type AuthUser,
  type EmailLinkParams,
  type SignInInput,
  type SignUpInput,
  type SignUpResult,
} from '@/services/auth';
import { supabase } from '@/services/supabase/client';

/** "guest" = explored without an account (spec: guests can browse/play
 * single-player; progress isn't saved - see the guest hints already wired
 * into CharacterSelectScreen/TodayDiscoveryCard). Persisted separately from
 * a real session so a returning guest skips onboarding but isn't mistaken
 * for a signed-in user. */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'guest';

const GUEST_MODE_KEY = 'oyno.auth.guestMode';

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
  signOut: () => Promise<void>;
  /** Exchanges the code from a tapped signup-confirmation email link and
   * signs the user in. Password-recovery links go through the same
   * service method directly from the recovery callback route instead -
   * that one deliberately does not touch this store's `status`. */
  completeSignupVerification: (params: EmailLinkParams) => Promise<boolean>;
  resendVerificationEmail: (email: string) => Promise<boolean>;
  deleteAccount: (password: string) => Promise<boolean>;
  continueAsGuest: () => Promise<void>;
  updateProfile: (input: { name?: string; email?: string }) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  clearError: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
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
    set({ isSubmitting: true, error: null });
    try {
      const result = await authService.signUp(input);
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      if (result.status === 'signed-in') {
        set({ status: 'authenticated', user: result.session.user, isSubmitting: false });
      } else {
        set({ isSubmitting: false });
      }
      return result;
    } catch (error) {
      set({ isSubmitting: false, error: error instanceof AuthError ? error.message : 'Белгисиз ката кетти.' });
      return false;
    }
  },

  signIn: async (input) => {
    set({ isSubmitting: true, error: null });
    try {
      const session = await authService.signIn(input);
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      set({ status: 'authenticated', user: session.user, isSubmitting: false });
      return true;
    } catch (error) {
      set({ isSubmitting: false, error: error instanceof AuthError ? error.message : 'Белгисиз ката кетти.' });
      return false;
    }
  },

  signOut: async () => {
    await authService.signOut();
    await AsyncStorage.removeItem(GUEST_MODE_KEY);
    set({ status: 'unauthenticated', user: null });
  },

  completeSignupVerification: async (params) => {
    set({ isSubmitting: true, error: null });
    try {
      const session = await authService.completeFromEmailLink(params);
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      set({ status: 'authenticated', user: session.user, isSubmitting: false });
      return true;
    } catch (error) {
      set({ isSubmitting: false, error: error instanceof AuthError ? error.message : 'Белгисиз ката кетти.' });
      return false;
    }
  },

  resendVerificationEmail: async (email) => {
    set({ error: null });
    try {
      await authService.resendVerificationEmail(email);
      return true;
    } catch (error) {
      set({ error: error instanceof AuthError ? error.message : 'Белгисиз ката кетти.' });
      return false;
    }
  },

  deleteAccount: async (password) => {
    set({ isSubmitting: true, error: null });
    try {
      await authService.deleteAccount(password);
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      set({ status: 'unauthenticated', user: null, isSubmitting: false });
      return true;
    } catch (error) {
      set({ isSubmitting: false, error: error instanceof AuthError ? error.message : 'Белгисиз ката кетти.' });
      return false;
    }
  },

  updateProfile: async (input) => {
    set({ isSubmitting: true, error: null });
    try {
      const session = await authService.updateProfile(input);
      set({ user: session.user, isSubmitting: false });
      return true;
    } catch (error) {
      set({ isSubmitting: false, error: error instanceof AuthError ? error.message : 'Белгисиз ката кетти.' });
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
      set({ isSubmitting: false, error: error instanceof AuthError ? error.message : 'Белгисиз ката кетти.' });
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
    useAuthStore.setState((state) => (state.status === 'authenticated' ? { status: 'unauthenticated', user: null } : {}));
  }
});
