/**
 * Auth logic around the (unchanged) Supabase service: validation helpers,
 * error mapping to localized copy, the store's sign-in / guest / session
 * restore / sign-out paths, offline fail-fast and duplicate-submit guard.
 * The service is mocked (no backend in Jest); the account-lifecycle hooks
 * are real registrations - sign-out must run them before the session ends.
 * Guest -> account MERGE rules themselves are covered end-to-end in
 * services/sync/sync.test.ts ("guest -> signed-in merge").
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthError } from '@/services/auth';
import { mapSupabaseError } from '@/services/auth/SupabaseAuthService';
import { authErrorKey } from '@/services/auth/authErrors';
import { parseEnabledProviders } from '@/services/auth/authProviders';
import { decideRouteGuardRedirect } from '@/services/navigation/routeGuard';
import { registerAccountHooks, useAuthStore } from '@/store/useAuthStore';

import { emailError, newPasswordError, signInPasswordError, validateNewPassword, validateSignIn, validateSignUp } from './authValidation';

let mockOffline = false;

// Only the network-facing service is replaced; the store, error mapping
// and validation are the real code.
jest.mock('@/services/auth/SupabaseAuthService', () => {
  const actual = jest.requireActual('@/services/auth/SupabaseAuthService');
  return {
    ...actual,
    supabaseAuthService: { getSession: jest.fn(), signIn: jest.fn(), signOut: jest.fn(() => Promise.resolve()), signUp: jest.fn() },
  };
});
jest.mock('@/services/supabase/client', () => ({ supabase: { auth: { onAuthStateChange: jest.fn(), signOut: jest.fn() } } }));
jest.mock('@/services/analytics/analytics', () => ({ track: jest.fn() }));
jest.mock('@/services/offline/networkStatus', () => ({ isOfflineNow: () => mockOffline }));
jest.mock('@/i18n', () => ({ __esModule: true, default: { t: (key: string) => `t:${key}` } }));

const mockService = (jest.requireMock('@/services/auth/SupabaseAuthService') as { supabaseAuthService: Record<'getSession' | 'signIn' | 'signOut' | 'signUp', jest.Mock> }).supabaseAuthService;

const USER = { id: 'user-a', name: 'Aida', email: 'a@example.com', createdAt: '2026-01-01' };
const PASSWORD = 'correct horse';

beforeEach(async () => {
  jest.clearAllMocks();
  mockOffline = false;
  await AsyncStorage.clear();
  useAuthStore.setState({ status: 'unauthenticated', user: null, isSubmitting: false, error: null });
});

describe('validation helpers', () => {
  it('email: required, then a plausible address', () => {
    expect(emailError('  ')).toBe('auth.v2.errors.emailRequired');
    expect(emailError('aida@')).toBe('auth.v2.errors.emailInvalid');
    expect(emailError(' aida@example.kg ')).toBeNull();
  });

  it('sign-in accepts any non-empty password (the server judges it); new passwords need 8+', () => {
    expect(signInPasswordError('')).toBe('auth.v2.errors.passwordRequired');
    expect(signInPasswordError('short')).toBeNull();
    expect(newPasswordError('1234567')).toBe('auth.v2.errors.passwordShort');
    expect(newPasswordError('12345678')).toBeNull();
  });

  it('whole forms return only the failing fields', () => {
    expect(validateSignIn({ email: 'a@b.kg', password: 'x' })).toEqual({});
    expect(validateSignUp({ name: ' ', email: 'bad', password: '123' })).toEqual({ name: 'auth.v2.errors.nameRequired', email: 'auth.v2.errors.emailInvalid', password: 'auth.v2.errors.passwordShort' });
    expect(validateNewPassword({ password: '12345678', confirmPassword: '12345679' })).toEqual({ confirmPassword: 'auth.v2.errors.passwordMismatch' });
  });
});

describe('error mapping', () => {
  it('maps backend codes and messages to typed errors (never raw text on screen)', () => {
    expect(mapSupabaseError({ message: 'x', code: 'invalid_credentials' }).code).toBe('invalid-credentials');
    expect(mapSupabaseError({ message: 'Failed to fetch' }).code).toBe('network-error');
    expect(mapSupabaseError({ message: 'x', name: 'AuthRetryableFetchError' } as never).code).toBe('network-error');
    expect(mapSupabaseError({ message: 'Auth session missing!', name: 'AuthSessionMissingError' } as never).code).toBe('invalid-code');
    expect(mapSupabaseError({ message: 'x', code: 'same_password' }).code).toBe('same-password');
  });

  it('turns each typed error into a localized key, by context', () => {
    expect(authErrorKey(new AuthError('invalid-credentials', ''), 'signIn')).toBe('auth.v2.errors.invalidCredentials');
    expect(authErrorKey(new AuthError('invalid-credentials', ''), 'account')).toBe('auth.v2.errors.wrongPassword');
    expect(authErrorKey(new AuthError('email-taken', ''), 'signUp')).toBe('auth.v2.errors.emailTaken');
    expect(authErrorKey(new AuthError('invalid-code', ''), 'reset')).toBe('auth.v2.errors.invalidResetCode');
    expect(authErrorKey(new AuthError('network-error', ''))).toBe('auth.v2.errors.offline');
    // Unknown failures (incl. non-AuthError exceptions) never leak their text.
    expect(authErrorKey(new Error('TypeError: secret stack at line 3'))).toBe('auth.v2.errors.unknown');
    // No account enumeration: "user not found" at sign-in reads like a wrong password.
    expect(authErrorKey(new AuthError('user-not-found', ''), 'signIn')).toBe('auth.v2.errors.invalidCredentials');
  });

  it('only shows social providers the project really enabled', () => {
    expect(parseEnabledProviders({ external: { google: true, apple: false, email: true } })).toEqual(['google']);
    expect(parseEnabledProviders({ external: { google: false, apple: false } })).toEqual([]);
    expect(parseEnabledProviders(null)).toEqual([]);
  });
});

describe('auth store', () => {
  it('successful sign in: authenticated, guest flag cleared, no error', async () => {
    await AsyncStorage.setItem('oyno.auth.guestMode', 'true');
    mockService.signIn.mockResolvedValue({ user: USER, token: 'tok' });
    await expect(useAuthStore.getState().signIn({ email: USER.email, password: PASSWORD })).resolves.toBe(true);
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', user: USER, error: null, isSubmitting: false });
    expect(await AsyncStorage.getItem('oyno.auth.guestMode')).toBeNull();
  });

  it('failed sign in: stays signed out with a localized message, never the raw backend text', async () => {
    mockService.signIn.mockRejectedValue(new AuthError('invalid-credentials', 'Email же сырсөз туура эмес.'));
    await expect(useAuthStore.getState().signIn({ email: USER.email, password: 'nope' })).resolves.toBe(false);
    expect(useAuthStore.getState()).toMatchObject({ status: 'unauthenticated', isSubmitting: false, error: 't:auth.v2.errors.invalidCredentials' });
  });

  it('offline: fails fast with a clear message and never calls the backend (no endless spinner)', async () => {
    mockOffline = true;
    await expect(useAuthStore.getState().signIn({ email: USER.email, password: PASSWORD })).resolves.toBe(false);
    expect(mockService.signIn).not.toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({ isSubmitting: false, error: 't:auth.v2.errors.offline' });
  });

  it('ignores a second submit while the first is running', async () => {
    let finish: (value: unknown) => void = () => {};
    mockService.signIn.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const first = useAuthStore.getState().signIn({ email: USER.email, password: PASSWORD });
    await expect(useAuthStore.getState().signIn({ email: USER.email, password: PASSWORD })).resolves.toBe(false);
    finish({ user: USER, token: 'tok' });
    await first;
    expect(mockService.signIn).toHaveBeenCalledTimes(1);
  });

  it('guest path: continue without account persists guest mode across restarts', async () => {
    await useAuthStore.getState().continueAsGuest();
    expect(useAuthStore.getState().status).toBe('guest');
    useAuthStore.setState({ status: 'loading' });
    mockService.getSession.mockResolvedValue(null);
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState().status).toBe('guest');
  });

  it('session restore: a stored session comes back as authenticated; while loading, no route redirect happens', async () => {
    useAuthStore.setState({ status: 'loading' });
    expect(decideRouteGuardRedirect({ authStatus: 'loading', hasChosenLanguage: true, hasCompletedOnboarding: true, hasChosenAgeGroup: true, pathname: '/home', ungatedRoutes: ['/sign-in'] })).toBeNull();
    mockService.getSession.mockResolvedValue({ user: USER, token: 'tok' });
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', user: USER });
  });

  it('session restore never gets stuck loading when reading the session fails', async () => {
    useAuthStore.setState({ status: 'loading' });
    mockService.getSession.mockRejectedValue(new Error('storage broken'));
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('sign out runs the account clean-up (private state) while the session still exists, then signs out', async () => {
    const order: string[] = [];
    registerAccountHooks({ beforeSignOut: async (userId) => void order.push(`clear:${userId}`) });
    mockService.signOut.mockImplementation(async () => void order.push('signOut'));
    useAuthStore.setState({ status: 'authenticated', user: USER });
    await useAuthStore.getState().signOut();
    expect(order).toEqual(['clear:user-a', 'signOut']);
    expect(useAuthStore.getState()).toMatchObject({ status: 'unauthenticated', user: null });
    registerAccountHooks({});
  });

  it('a guest can open Sign in / Create account; a signed-in account cannot', () => {
    const base = { hasChosenLanguage: true, hasCompletedOnboarding: true, hasChosenAgeGroup: true, ungatedRoutes: ['/sign-in', '/sign-up'] } as const;
    expect(decideRouteGuardRedirect({ ...base, authStatus: 'guest', pathname: '/sign-in' })).toBeNull();
    expect(decideRouteGuardRedirect({ ...base, authStatus: 'authenticated', pathname: '/sign-in' })).toBe('/home');
  });
});
