/**
 * Account deletion with reauthentication - behaviour against a mocked
 * Supabase client and in-app browser (no real backend here). The server's
 * own recent-sign-in check lives in
 * supabase/migrations/20261004000004_delete_own_account_recent_auth.sql.
 */
const mockAuth = {
  getUser: jest.fn(),
  getSession: jest.fn(),
  setSession: jest.fn(),
  signInWithPassword: jest.fn(),
  signInWithOAuth: jest.fn(),
  exchangeCodeForSession: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChange: jest.fn(),
};
const mockRpc = jest.fn();
jest.mock('@/services/supabase/client', () => ({
  supabase: {
    // Lazy: the factory runs when the module is imported (hoisted above mockAuth).
    get auth() {
      return mockAuth;
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  },
}));
const mockOpenAuth = jest.fn();
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: (...args: unknown[]) => mockOpenAuth(...args) }));
jest.mock('expo-linking', () => ({ createURL: (path: string) => `oyno://${path}` }));

import { deletionMethodFor, supabaseAuthService } from './SupabaseAuthService';

const userA = { id: 'user-a', email: 'a@example.kg', identities: [{ provider: 'email' }], app_metadata: { providers: ['email'] } };
const oauthA = { id: 'user-a', email: 'a@gmail.com', identities: [{ provider: 'google' }], app_metadata: { providers: ['google'] } };
const sessionOf = (user: { id: string }) => ({ access_token: `access-${user.id}`, refresh_token: `refresh-${user.id}`, user });

beforeEach(() => {
  for (const fn of Object.values(mockAuth)) fn.mockReset();
  mockRpc.mockReset().mockResolvedValue({ error: null });
  mockOpenAuth.mockReset();
  mockAuth.signOut.mockResolvedValue({ error: null });
  mockAuth.signInWithOAuth.mockResolvedValue({ data: { url: 'https://provider.example/authorize' }, error: null });
});

describe('deletion method', () => {
  it('password for email accounts, the linked provider for OAuth-only accounts, none without either', () => {
    expect(deletionMethodFor(userA as never)).toEqual({ kind: 'password' });
    expect(deletionMethodFor(oauthA as never)).toEqual({ kind: 'oauth', provider: 'google' });
    expect(deletionMethodFor({ email: 'x@icloud.com', identities: [{ provider: 'apple' }], app_metadata: {} } as never)).toEqual({ kind: 'oauth', provider: 'apple' });
    expect(deletionMethodFor({ email: 'x@y.kg', identities: [{ provider: 'github' }], app_metadata: {} } as never)).toBeNull();
    // An account that has BOTH keeps the password confirmation.
    expect(deletionMethodFor({ ...userA, identities: [{ provider: 'google' }, { provider: 'email' }] } as never)).toEqual({ kind: 'password' });
  });

  it('getDeletionMethod is null for an expired session', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'JWT expired' } });
    await expect(supabaseAuthService.getDeletionMethod()).resolves.toBeNull();
  });
});

describe('password accounts', () => {
  beforeEach(() => mockAuth.getUser.mockResolvedValue({ data: { user: userA }, error: null }));

  it('valid password: reauthenticates, deletes via the RPC, signs out', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: { user: userA, session: sessionOf(userA) }, error: null });
    await supabaseAuthService.deleteAccount({ kind: 'password', password: 'correct-horse' });
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@example.kg', password: 'correct-horse' });
    expect(mockRpc).toHaveBeenCalledWith('delete_own_account');
    expect(mockAuth.signInWithPassword.mock.invocationCallOrder[0]).toBeLessThan(mockRpc.mock.invocationCallOrder[0]);
    expect(mockAuth.signOut).toHaveBeenCalled();
  });

  it('incorrect password: nothing is deleted', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: { message: 'Invalid login credentials', code: 'invalid_credentials' } });
    await expect(supabaseAuthService.deleteAccount({ kind: 'password', password: 'nope' })).rejects.toMatchObject({ code: 'invalid-credentials' });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  it('RPC failure is never reported as success and leaves the session alone', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: { user: userA, session: sessionOf(userA) }, error: null });
    mockRpc.mockResolvedValue({ error: { message: 'internal error' } });
    await expect(supabaseAuthService.deleteAccount({ kind: 'password', password: 'correct-horse' })).rejects.toMatchObject({ code: 'unknown' });
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  it('server says the sign-in is not recent (REAUTH_REQUIRED): reported as such, nothing deleted', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: { user: userA, session: sessionOf(userA) }, error: null });
    mockRpc.mockResolvedValue({ error: { message: 'REAUTH_REQUIRED' } });
    await expect(supabaseAuthService.deleteAccount({ kind: 'password', password: 'correct-horse' })).rejects.toMatchObject({ code: 'reauth-required' });
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });
});

describe('OAuth-only accounts', () => {
  beforeEach(() => {
    mockAuth.getUser.mockResolvedValue({ data: { user: oauthA }, error: null });
    mockAuth.getSession.mockResolvedValue({ data: { session: sessionOf(oauthA) }, error: null });
    mockOpenAuth.mockResolvedValue({ type: 'success', url: 'oyno://auth-callback?code=fresh-code' });
  });

  it('same-account confirmation: fresh private provider sign-in, then the RPC', async () => {
    mockAuth.exchangeCodeForSession.mockResolvedValue({ data: { session: sessionOf(oauthA) }, error: null });
    await supabaseAuthService.deleteAccount({ kind: 'oauth', provider: 'google' });
    expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ provider: 'google' }));
    expect(mockOpenAuth).toHaveBeenCalledWith('https://provider.example/authorize', 'oyno://auth-callback', { preferEphemeralSession: true });
    expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith('fresh-code');
    expect(mockRpc).toHaveBeenCalledWith('delete_own_account');
    expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('a DIFFERENT account at the provider is rejected; the original session is restored; nobody is deleted', async () => {
    const userB = { id: 'user-b', email: 'b@gmail.com', identities: [{ provider: 'google' }] };
    mockAuth.exchangeCodeForSession.mockResolvedValue({ data: { session: sessionOf(userB) }, error: null });
    mockAuth.setSession.mockResolvedValue({ data: {}, error: null });
    await expect(supabaseAuthService.deleteAccount({ kind: 'oauth', provider: 'google' })).rejects.toMatchObject({ code: 'reauth-mismatch' });
    expect(mockAuth.setSession).toHaveBeenCalledWith({ access_token: 'access-user-a', refresh_token: 'refresh-user-a' });
    expect(mockRpc).not.toHaveBeenCalled();
    // No sign-out event: the app must not treat this as the session ending.
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  it('different account and the original session cannot be restored: no foreign session is left behind', async () => {
    mockAuth.exchangeCodeForSession.mockResolvedValue({ data: { session: sessionOf({ id: 'user-b' }) }, error: null });
    mockAuth.setSession.mockResolvedValue({ data: {}, error: { message: 'Invalid Refresh Token' } });
    await expect(supabaseAuthService.deleteAccount({ kind: 'oauth', provider: 'google' })).rejects.toMatchObject({ code: 'user-not-found' });
    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('a cancelled sheet is not a confirmation: nothing exchanged, nothing deleted', async () => {
    mockOpenAuth.mockResolvedValue({ type: 'cancel' });
    await expect(supabaseAuthService.deleteAccount({ kind: 'oauth', provider: 'google' })).rejects.toMatchObject({ code: 'cancelled' });
    expect(mockAuth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('a provider the account is not linked to cannot confirm it (no sheet is even opened)', async () => {
    await expect(supabaseAuthService.deleteAccount({ kind: 'oauth', provider: 'apple' })).rejects.toMatchObject({ code: 'reauth-mismatch' });
    expect(mockOpenAuth).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('expired session: nothing is attempted', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'JWT expired' } });
    await expect(supabaseAuthService.deleteAccount({ kind: 'oauth', provider: 'google' })).rejects.toMatchObject({ code: 'user-not-found' });
    expect(mockOpenAuth).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('session gone between checks (no current session): nothing is attempted', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(supabaseAuthService.deleteAccount({ kind: 'oauth', provider: 'google' })).rejects.toMatchObject({ code: 'user-not-found' });
    expect(mockOpenAuth).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
