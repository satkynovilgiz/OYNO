/**
 * Account deletion, end to end on the client: the REAL useAuthStore, the
 * REAL SupabaseAuthService and the REAL account-generation module, over
 * fake Supabase clients that keep their own session and EMIT auth-state
 * events like supabase-js does. The store's own onAuthStateChange
 * listener runs for real, so these tests see what the app would see.
 *
 * Not covered here (no database in this environment): the SQL itself -
 * see supabase/migrations/20261005000001_delete_account_binding.sql.
 */
type User = { id: string; email: string; identities: { provider: string }[]; app_metadata: { providers: string[] } };
type Listener = (event: string, session: unknown) => void;
type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => (resolve = res));
  return { promise, resolve };
}

const USERS: Record<string, User & { password?: string }> = {
  'user-a': { id: 'user-a', email: 'a@example.kg', password: 'correct-horse', identities: [{ provider: 'email' }, { provider: 'google' }], app_metadata: { providers: ['email', 'google'] } },
  'user-b': { id: 'user-b', email: 'b@gmail.com', identities: [{ provider: 'google' }], app_metadata: { providers: ['google'] } },
  'user-g': { id: 'user-g', email: 'g@gmail.com', identities: [{ provider: 'google' }], app_metadata: { providers: ['google'] } },
};
/** Which account the provider signs in next (the person's choice at Google). */
const mockProvider = { nextUserId: 'user-a' };

function mockMakeClient(name: string) {
  const listeners: Listener[] = [];
  const state = { userId: null as string | null, events: [] as string[] };
  const emit = (event: string) => {
    state.events.push(event);
    for (const listener of [...listeners]) listener(event, state.userId ? { user: USERS[state.userId] } : null);
  };
  const sessionOf = (id: string) => ({ access_token: `${name}-access-${id}`, refresh_token: `${name}-refresh-${id}`, user: USERS[id] });
  const client = {
    name,
    state,
    emit,
    auth: {
      onAuthStateChange: jest.fn((listener: Listener) => {
        listeners.push(listener);
        return { data: { subscription: { unsubscribe: () => undefined } } };
      }),
      getUser: jest.fn(async () => (state.userId ? { data: { user: USERS[state.userId] }, error: null } : { data: { user: null }, error: { message: 'JWT expired' } })),
      getSession: jest.fn(async () => ({ data: { session: state.userId ? sessionOf(state.userId) : null }, error: null })),
      signInWithPassword: jest.fn(async ({ email, password }: { email: string; password: string }) => {
        const user = Object.values(USERS).find((candidate) => candidate.email === email);
        if (!user || !user.password || user.password !== password) return { data: { user: null, session: null }, error: { message: 'Invalid login credentials', code: 'invalid_credentials' } };
        state.userId = user.id;
        emit('SIGNED_IN');
        return { data: { user, session: sessionOf(user.id) }, error: null };
      }),
      signInWithOAuth: jest.fn(async () => ({ data: { url: 'https://provider.example/authorize' }, error: null })),
      exchangeCodeForSession: jest.fn(async () => {
        state.userId = mockProvider.nextUserId;
        emit('SIGNED_IN');
        return { data: { session: sessionOf(state.userId) }, error: null };
      }),
      setSession: jest.fn(),
      signOut: jest.fn(async () => {
        state.userId = null;
        emit('SIGNED_OUT');
        return { error: null };
      }),
    },
    rpc: jest.fn(async (_fn: string, _args?: Record<string, unknown>): Promise<{ error: { message: string; code?: string } | null }> => ({ error: null })),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  };
  return client;
}
type FakeClient = ReturnType<typeof mockMakeClient>;

const mockWorld = { global: mockMakeClient('global'), confirmations: [] as FakeClient[], nextConfirmation: null as ((client: FakeClient) => void) | null };
jest.mock('@/services/supabase/client', () => ({
  get supabase() {
    return mockWorld.global;
  },
  createConfirmationClient: () => {
    const client = mockMakeClient(`confirm-${mockWorld.confirmations.length + 1}`);
    mockWorld.confirmations.push(client);
    mockWorld.nextConfirmation?.(client);
    return client;
  },
}));
const mockOpenAuth = jest.fn(async (..._args: unknown[]): Promise<{ type: string; url?: string }> => ({ type: 'success', url: 'oyno://auth-callback?code=fresh' }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: (...args: unknown[]) => mockOpenAuth(...args) }));
jest.mock('expo-linking', () => ({ createURL: (path: string) => `oyno://${path}` }));
jest.mock('@/services/analytics/analytics', () => ({ track: jest.fn() }));

// Loaded only now: the store subscribes to the (fake) app client at import time.
/* eslint-disable @typescript-eslint/no-require-imports */
const en = require('@/i18n/locales/en.json');
// The app's default language is Kyrgyz: error messages come from kg.json.
const kg = require('@/i18n/locales/kg.json');
const { supabaseAuthService, deletionOptionsFor } = require('@/services/auth/SupabaseAuthService') as typeof import('@/services/auth/SupabaseAuthService');
const { registerAccountHooks, useAuthStore } = require('./useAuthStore') as typeof import('./useAuthStore');
/* eslint-enable @typescript-eslint/no-require-imports */

const hooks = { afterAccountDeleted: jest.fn(async (_id: string) => undefined), afterSessionLost: jest.fn(async (_id: string) => undefined), beforeSignOut: jest.fn(async (_id: string) => undefined) };
const signedInAs = (id: string) => {
  mockWorld.global.state.userId = id;
  useAuthStore.setState({ status: 'authenticated', user: { id, name: id, email: USERS[id].email, createdAt: '2026-01-01' }, isSubmitting: false, error: null });
};
const allRpcCalls = () => [mockWorld.global, ...mockWorld.confirmations].flatMap((client) => client.rpc.mock.calls.map(([fn, args]) => `${client.name}:${fn}:${JSON.stringify(args ?? null)}`));

beforeEach(() => {
  mockWorld.global.state.events.length = 0;
  for (const fn of [mockWorld.global.rpc, mockWorld.global.auth.signInWithPassword, mockWorld.global.auth.exchangeCodeForSession, mockWorld.global.auth.setSession, mockWorld.global.auth.signOut]) fn.mockClear();
  mockWorld.confirmations.length = 0;
  mockWorld.nextConfirmation = null;
  mockProvider.nextUserId = 'user-a';
  mockOpenAuth.mockClear();
  for (const hook of Object.values(hooks)) hook.mockClear();
  registerAccountHooks(hooks);
  signedInAs('user-a');
});

describe('confirmation choices', () => {
  it('offers password AND every linked provider; never asserts a password exists', () => {
    expect(deletionOptionsFor(USERS['user-a'] as never)).toEqual({ accountId: 'user-a', password: true, providers: ['google'] });
    expect(deletionOptionsFor(USERS['user-b'] as never)).toEqual({ accountId: 'user-b', password: false, providers: ['google'] });
    expect(deletionOptionsFor({ ...USERS['user-b'], identities: [{ provider: 'github' }], app_metadata: { providers: [] } } as never)).toBeNull();
    // The UI says "With password" (a choice), not "your password".
    expect(en.settings.account.deleteWithPassword).toBe('With password');
  });

  it('reads the options from the app session', async () => {
    await expect(supabaseAuthService.getDeletionOptions()).resolves.toMatchObject({ accountId: 'user-a', password: true });
  });
});

describe('successful deletion', () => {
  it('password: confirmed on an isolated client, deleted with that fresh token, bound to the account id', async () => {
    await expect(useAuthStore.getState().deleteAccount({ kind: 'password', password: 'correct-horse' })).resolves.toBe(true);
    expect(allRpcCalls()).toEqual(['confirm-1:delete_own_account:{"p_expected_user_id":"user-a"}']);
    // The app's own session was never replaced during confirmation.
    expect(mockWorld.global.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(mockWorld.global.state.events).toEqual(['SIGNED_OUT']);
    expect(hooks.afterAccountDeleted).toHaveBeenCalledWith('user-a');
    // The deletion's own sign-out event is not mistaken for a lost session.
    expect(hooks.afterSessionLost).not.toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({ status: 'unauthenticated', user: null });
  });

  it('linked provider (Google) on a password-capable account', async () => {
    await expect(useAuthStore.getState().deleteAccount({ kind: 'oauth', provider: 'google' })).resolves.toBe(true);
    expect(mockOpenAuth).toHaveBeenCalledWith('https://provider.example/authorize', 'oyno://auth-callback', { preferEphemeralSession: true });
    expect(mockWorld.global.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockWorld.confirmations[0].auth.exchangeCodeForSession).toHaveBeenCalled();
    expect(allRpcCalls()).toEqual(['confirm-1:delete_own_account:{"p_expected_user_id":"user-a"}']);
  });

  it('server without the binding migration: falls back to the older function with the same verified token', async () => {
    mockWorld.nextConfirmation = (client) =>
      client.rpc.mockResolvedValueOnce({ error: { message: 'Could not find the function public.delete_own_account(p_expected_user_id)', code: 'PGRST202' } }).mockResolvedValueOnce({ error: null });
    await expect(useAuthStore.getState().deleteAccount({ kind: 'password', password: 'correct-horse' })).resolves.toBe(true);
    expect(allRpcCalls()).toEqual(['confirm-1:delete_own_account:{"p_expected_user_id":"user-a"}', 'confirm-1:delete_own_account:null']);
  });
});

describe('nothing is deleted, local data kept', () => {
  const expectUntouched = () => {
    expect(allRpcCalls()).toEqual([]);
    expect(hooks.afterAccountDeleted).not.toHaveBeenCalled();
    expect(hooks.afterSessionLost).not.toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', user: { id: 'user-a' } });
    expect(mockWorld.global.state.userId).toBe('user-a');
  };

  it('wrong account at the provider: rejected; the app session never saw the other account', async () => {
    mockProvider.nextUserId = 'user-b';
    await expect(useAuthStore.getState().deleteAccount({ kind: 'oauth', provider: 'google' })).resolves.toBe(false);
    expect(useAuthStore.getState().error).toBe(kg.auth.v2.errors.reauthMismatch);
    // No SIGNED_IN for B on the app client: sync / adoption / uploads never ran as B.
    expect(mockWorld.global.state.events).toEqual([]);
    expect(mockWorld.global.auth.setSession).not.toHaveBeenCalled();
    // The isolated client's B session was discarded.
    expect(mockWorld.confirmations[0].auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expectUntouched();
  });

  it('wrong password', async () => {
    await expect(useAuthStore.getState().deleteAccount({ kind: 'password', password: 'nope' })).resolves.toBe(false);
    expect(useAuthStore.getState().error).toBe(kg.auth.v2.errors.wrongPassword);
    expectUntouched();
  });

  it('cancelled provider sheet: silent "cancelled"', async () => {
    mockOpenAuth.mockResolvedValueOnce({ type: 'cancel' });
    await expect(useAuthStore.getState().deleteAccount({ kind: 'oauth', provider: 'google' })).resolves.toBe('cancelled');
    expect(useAuthStore.getState().error).toBeNull();
    expectUntouched();
  });

  it('a provider this account is not linked to cannot confirm it', async () => {
    await expect(useAuthStore.getState().deleteAccount({ kind: 'oauth', provider: 'apple' })).resolves.toBe(false);
    expect(mockOpenAuth).not.toHaveBeenCalled();
    expectUntouched();
  });

  it('server says ACCOUNT_MISMATCH or REAUTH_REQUIRED: reported, nothing cleaned up', async () => {
    for (const message of ['ACCOUNT_MISMATCH', 'REAUTH_REQUIRED']) {
      mockWorld.nextConfirmation = (client) => client.rpc.mockResolvedValueOnce({ error: { message } });
      await expect(useAuthStore.getState().deleteAccount({ kind: 'password', password: 'correct-horse' })).resolves.toBe(false);
      expect(hooks.afterAccountDeleted).not.toHaveBeenCalled();
      expect(useAuthStore.getState().status).toBe('authenticated');
    }
  });
});

describe('session changes cannot delete a different account', () => {
  it('the app switches to another account while the person is confirming: no RPC at all', async () => {
    const gate = deferred<void>();
    mockWorld.nextConfirmation = (client) => {
      const original = client.auth.signInWithPassword.getMockImplementation()!;
      client.auth.signInWithPassword.mockImplementationOnce(async (input) => {
        await gate.promise;
        return original(input);
      });
    };
    const running = useAuthStore.getState().deleteAccount({ kind: 'password', password: 'correct-horse' });
    await Promise.resolve();
    signedInAs('user-g');
    gate.resolve();
    await expect(running).resolves.toBe(false);
    expect(allRpcCalls()).toEqual([]);
    expect(hooks.afterAccountDeleted).not.toHaveBeenCalled();
  });

  it('signed out and back into the SAME account while confirming: the old request is stale', async () => {
    const gate = deferred<void>();
    mockWorld.nextConfirmation = (client) => {
      const original = client.auth.signInWithPassword.getMockImplementation()!;
      client.auth.signInWithPassword.mockImplementationOnce(async (input) => {
        await gate.promise;
        return original(input);
      });
    };
    const running = useAuthStore.getState().deleteAccount({ kind: 'password', password: 'correct-horse' });
    await Promise.resolve();
    useAuthStore.setState({ status: 'unauthenticated', user: null });
    signedInAs('user-a');
    gate.resolve();
    await expect(running).resolves.toBe(false);
    expect(allRpcCalls()).toEqual([]);
  });

  it('the server-side session changes right before the destructive call: no RPC', async () => {
    // First check (start) sees A; the re-check just before the RPC sees G.
    mockWorld.global.auth.getUser
      .mockImplementationOnce(async () => ({ data: { user: USERS['user-a'] }, error: null }))
      .mockImplementationOnce(async () => ({ data: { user: USERS['user-g'] }, error: null }));
    await expect(useAuthStore.getState().deleteAccount({ kind: 'password', password: 'correct-horse' })).resolves.toBe(false);
    expect(allRpcCalls()).toEqual([]);
  });

  it('the session ending on its own during confirmation is still handled as a lost session (real SIGNED_OUT event)', async () => {
    const gate = deferred<void>();
    mockWorld.nextConfirmation = (client) => {
      const original = client.auth.signInWithPassword.getMockImplementation()!;
      client.auth.signInWithPassword.mockImplementationOnce(async (input) => {
        await gate.promise;
        return original(input);
      });
    };
    const running = useAuthStore.getState().deleteAccount({ kind: 'password', password: 'correct-horse' });
    await Promise.resolve();
    // Refresh token expired underneath the app.
    mockWorld.global.state.userId = null;
    mockWorld.global.emit('SIGNED_OUT');
    gate.resolve();
    await expect(running).resolves.toBe(false);
    expect(hooks.afterSessionLost).toHaveBeenCalledWith('user-a');
    expect(allRpcCalls()).toEqual([]);
  });
});
