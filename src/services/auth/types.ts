export type AuthUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export type AuthSession = {
  user: AuthUser;
  /** Supabase access token. */
  token: string;
};

export type AuthErrorCode =
  | 'invalid-email'
  | 'weak-password'
  | 'password-mismatch'
  | 'email-taken'
  | 'invalid-credentials'
  | 'user-not-found'
  | 'invalid-code'
  | 'not-verified'
  | 'rate-limited'
  | 'network-error'
  /** The user closed the OAuth browser sheet before finishing - not a
   * real error, callers should treat this as a silent no-op. */
  | 'cancelled'
  | 'unknown';

export class AuthError extends Error {
  code: AuthErrorCode;
  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'AuthError';
  }
}

export type SignUpInput = {
  name: string;
  email: string;
  password: string;
};

export type SignInInput = {
  email: string;
  password: string;
};

export type SignUpResult =
  /** The normal path when the Supabase project has "Confirm email"
   * enabled (the default) - no session exists yet until the code is
   * verified. */
  | { status: 'verification-required'; email: string }
  /** Only happens if the project has email confirmation turned off. */
  | { status: 'signed-in'; session: AuthSession };

export type OAuthProvider = 'google' | 'apple';

export type OAuthSignInResult = {
  session: AuthSession;
  /** True when this is the account's first-ever sign-in (its auth.users
   * row was just created by this call) - callers use this to route to
   * profile setup (name + character) instead of straight to /home,
   * matching what email signUp already does before its first /home. */
  isNewUser: boolean;
};

/**
 * Backend-agnostic auth contract. `SupabaseAuthService` is the only
 * implementation (see its own doc comment) - screens/the store were built
 * against this interface from Phase 2 onward specifically so the backend
 * underneath it could change without touching them.
 *
 * Verification uses typed OTP codes emailed to the user (not magic
 * links) - a deliberate choice, not the original one. Magic links were
 * tried first and worked on web, but Expo Go can't reliably open a link
 * tapped from an external app (a known platform limitation - its
 * `exp://` scheme isn't meant for arbitrary OS-level link handoff), which
 * made testing on a real phone unworkable before a dev/production build
 * exists. A typed code sidesteps that entirely: no link ever needs to
 * open, the user just types what the email shows. See PROGRESS_AUDIT.md.
 */
export type AuthService = {
  getSession(): Promise<AuthSession | null>;
  signUp(input: SignUpInput): Promise<SignUpResult>;
  signIn(input: SignInInput): Promise<AuthSession>;
  /** Opens the provider's own sign-in page in an in-app browser sheet and
   * exchanges the resulting redirect for a session. Throws AuthError with
   * code 'cancelled' (not a real error) if the user closes the sheet. */
  signInWithOAuth(provider: OAuthProvider): Promise<OAuthSignInResult>;
  signOut(): Promise<void>;
  /** Confirms the code emailed after signUp() and returns the now-active session. */
  verifyEmail(email: string, code: string): Promise<AuthSession>;
  /** Caller is responsible for its own cooldown timer (spec Section 6) - this
   * always attempts a real resend; Supabase's own rate limiting is the
   * backstop against abuse. */
  resendVerificationEmail(email: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  /** Verifies the emailed code and establishes a temporary recovery
   * session; confirmPasswordReset() then uses that session, so it no
   * longer needs the email/code passed to it again. */
  verifyPasswordResetCode(email: string, code: string): Promise<void>;
  /** Uses whatever session verifyPasswordResetCode just established -
   * signs out afterward so the user re-authenticates with the new
   * password rather than silently staying logged in from the reset. */
  confirmPasswordReset(newPassword: string): Promise<void>;
  /** Requires the current password (spec Section 63) - not just a bare
   * confirmation tap. */
  deleteAccount(password: string): Promise<void>;
  /** Updates the signed-in user's profile fields, returns the updated
   * session. Email changes trigger Supabase's own re-verification flow
   * for the new address. */
  updateProfile(input: { name?: string; email?: string }): Promise<AuthSession>;
  /** Requires the current password (spec Section 59). */
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
};
