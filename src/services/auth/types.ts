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
