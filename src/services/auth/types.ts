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
  | 'invalid-link'
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

/** Whichever of Supabase's two flow types the tapped email link produced -
 * see useAuthCallbackParams's doc comment. Exactly one of `code` or the
 * token pair is present. */
export type EmailLinkParams = { code: string } | { accessToken: string; refreshToken: string };

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
 */
export type AuthService = {
  getSession(): Promise<AuthSession | null>;
  signUp(input: SignUpInput): Promise<SignUpResult>;
  signIn(input: SignInInput): Promise<AuthSession>;
  signOut(): Promise<void>;
  /** Caller is responsible for its own cooldown timer (spec Section 6) - this
   * always attempts a real resend; Supabase's own rate limiting is the
   * backstop against abuse. */
  resendVerificationEmail(email: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  /** Exchanges the params from a tapped email link (signup confirmation
   * or password recovery - both land here, the app's two separate
   * deep-link routes call this the same way) for a real session. Signup
   * confirmation and password recovery are otherwise identical at the
   * Supabase API level; which one it was is which deep-link route the OS
   * opened, not anything this call itself reports. */
  completeFromEmailLink(params: EmailLinkParams): Promise<AuthSession>;
  /** Uses whatever session is currently active (the one
   * completeFromEmailLink just established for a recovery link) - signs
   * out afterward so the user re-authenticates with the new password
   * rather than silently staying logged in from the recovery link. */
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
