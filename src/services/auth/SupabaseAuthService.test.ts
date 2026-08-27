/**
 * Mocks the Supabase client rather than hitting a real backend (no way to
 * run one in this environment). Covers mapSupabaseError's code/message
 * mapping table directly (pure function, the single most bug-prone part
 * of this file - one wrong regex or missing code silently shows the
 * generic "unknown error" message instead of an actionable one), plus
 * signUp's own validation and its one real, previously-shipped bug: a
 * signup for an already-registered email comes back as a 200 with zero
 * identities (Supabase's anti-enumeration behavior) rather than an error,
 * which this file must detect itself (see the code's own doc comment).
 */
import { AuthError } from './types';

jest.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: { signUp: jest.fn() },
    from: jest.fn(() => ({
      select: jest.fn(() => ({ eq: jest.fn(() => ({ maybeSingle: jest.fn(() => Promise.resolve({ data: null })) })) })),
    })),
  },
}));

import { supabase } from '@/services/supabase/client';

import { mapSupabaseError, supabaseAuthService } from './SupabaseAuthService';

const mockSignUp = supabase.auth.signUp as jest.Mock;

describe('mapSupabaseError', () => {
  it('maps a known Supabase error code to the matching AuthError', () => {
    const result = mapSupabaseError({ message: 'x', code: 'user_already_exists' });
    expect(result).toBeInstanceOf(AuthError);
    expect(result.code).toBe('email-taken');
  });

  it('maps weak_password to weak-password with the configured minimum length in the message', () => {
    const result = mapSupabaseError({ message: 'x', code: 'weak_password' });
    expect(result.code).toBe('weak-password');
    expect(result.message).toContain('8');
  });

  it('falls back to a message-pattern match when there is no error code', () => {
    expect(mapSupabaseError({ message: 'Network request failed' }).code).toBe('network-error');
    expect(mapSupabaseError({ message: 'User already registered' }).code).toBe('email-taken');
    expect(mapSupabaseError({ message: 'rate limit exceeded' }).code).toBe('rate-limited');
  });

  it('falls back to unknown for a genuinely unrecognized error', () => {
    expect(mapSupabaseError({ message: 'something Supabase has never returned before' }).code).toBe('unknown');
  });

  it('handles a null error without throwing', () => {
    expect(mapSupabaseError(null).code).toBe('unknown');
  });
});

describe('supabaseAuthService.signUp', () => {
  beforeEach(() => mockSignUp.mockReset());

  it('rejects a malformed email before ever calling Supabase', async () => {
    await expect(supabaseAuthService.signUp({ name: 'A', email: 'not-an-email', password: 'longenough' })).rejects.toMatchObject({
      code: 'invalid-email',
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('rejects a too-short password before ever calling Supabase', async () => {
    await expect(supabaseAuthService.signUp({ name: 'A', email: 'a@b.com', password: 'short' })).rejects.toMatchObject({
      code: 'weak-password',
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('treats a zero-identities success response as an already-registered email, not a real signup', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'u1', identities: [] }, session: null },
      error: null,
    });

    await expect(
      supabaseAuthService.signUp({ name: 'A', email: 'taken@example.com', password: 'longenough' }),
    ).rejects.toMatchObject({ code: 'email-taken' });
  });

  it('reports verification-required for a genuine new signup', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'u1', identities: [{ id: 'identity-1' }] }, session: null },
      error: null,
    });

    const result = await supabaseAuthService.signUp({ name: 'A', email: 'new@example.com', password: 'longenough' });

    expect(result).toEqual({ status: 'verification-required', email: 'new@example.com' });
  });

  it('lower-cases and trims the email before sending it to Supabase', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'u1', identities: [{ id: 'identity-1' }] }, session: null },
      error: null,
    });

    await supabaseAuthService.signUp({ name: 'A', email: '  Test@Example.COM  ', password: 'longenough' });

    expect(mockSignUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'test@example.com' }));
  });
});
