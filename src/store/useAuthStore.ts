import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { AuthError, authService, type AuthUser, type SignInInput, type SignUpInput } from '@/services/auth';

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
  signUp: (input: SignUpInput) => Promise<boolean>;
  signIn: (input: SignInInput) => Promise<boolean>;
  signOut: () => Promise<void>;
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
      const session = await authService.signUp(input);
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      set({ status: 'authenticated', user: session.user, isSubmitting: false });
      return true;
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
