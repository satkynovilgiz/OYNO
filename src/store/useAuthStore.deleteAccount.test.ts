/**
 * The store side of account deletion: local account cleanup runs ONLY after
 * the service confirmed the deletion; a cancelled provider sheet is silent;
 * any failure leaves the signed-in state and local data untouched.
 */
const mockDeleteAccount = jest.fn();
jest.mock('@/services/auth', () => {
  const actual = jest.requireActual('@/services/auth/types');
  return { ...actual, authService: { deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args) } };
});
jest.mock('@/services/supabase/client', () => ({ supabase: { auth: { onAuthStateChange: jest.fn() } } }));
jest.mock('@/services/analytics/analytics', () => ({ track: jest.fn() }));

import { AuthError } from '@/services/auth/types';

import { registerAccountHooks, useAuthStore } from './useAuthStore';

const afterAccountDeleted = jest.fn(async () => undefined);
const user = { id: 'user-a', name: 'A', email: 'a@example.kg', createdAt: '2026-01-01' };

beforeEach(() => {
  mockDeleteAccount.mockReset();
  afterAccountDeleted.mockClear();
  registerAccountHooks({ afterAccountDeleted });
  useAuthStore.setState({ status: 'authenticated', user, isSubmitting: false, error: null });
});

describe('useAuthStore.deleteAccount', () => {
  it('success: deletes, then cleans up THIS account locally and signs the app out', async () => {
    mockDeleteAccount.mockResolvedValue(undefined);
    await expect(useAuthStore.getState().deleteAccount({ kind: 'oauth', provider: 'google' })).resolves.toBe(true);
    expect(mockDeleteAccount).toHaveBeenCalledWith({ kind: 'oauth', provider: 'google' });
    expect(afterAccountDeleted).toHaveBeenCalledWith('user-a');
    expect(useAuthStore.getState()).toMatchObject({ status: 'unauthenticated', user: null, isSubmitting: false });
  });

  it.each([
    ['wrong password', new AuthError('invalid-credentials', '')],
    ['different account', new AuthError('reauth-mismatch', '')],
    ['server needs a recent sign-in', new AuthError('reauth-required', '')],
    ['RPC failure', new AuthError('unknown', '')],
    ['expired session', new AuthError('user-not-found', '')],
  ])('%s: false, error set, no local cleanup, still signed in', async (_label, error) => {
    mockDeleteAccount.mockRejectedValue(error);
    await expect(useAuthStore.getState().deleteAccount({ kind: 'password', password: 'x' })).resolves.toBe(false);
    expect(afterAccountDeleted).not.toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', user, isSubmitting: false });
    expect(useAuthStore.getState().error).toBeTruthy();
  });

  it('cancelled provider sheet: "cancelled", no error message, nothing cleaned up', async () => {
    mockDeleteAccount.mockRejectedValue(new AuthError('cancelled', ''));
    await expect(useAuthStore.getState().deleteAccount({ kind: 'oauth', provider: 'apple' })).resolves.toBe('cancelled');
    expect(useAuthStore.getState().error).toBeNull();
    expect(afterAccountDeleted).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('error messages for the new cases exist in KG/RU/EN', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const locales = [require('@/i18n/locales/kg.json'), require('@/i18n/locales/ru.json'), require('@/i18n/locales/en.json')];
    for (const locale of locales) {
      expect(locale.auth.v2.errors.reauthMismatch).toBeTruthy();
      expect(locale.auth.v2.errors.reauthRequired).toBeTruthy();
      expect(locale.settings.account.deleteConfirmWithProvider).toContain('{{provider}}');
      expect(locale.settings.account.deleteOAuthHint).toBeTruthy();
    }
  });
});
