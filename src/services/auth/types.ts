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
  /** New password equals the current one. */
  | 'same-password'
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
  /** Account deletion: the confirming sign-in was a DIFFERENT account
   * (or a provider this account isn't linked to). Nothing was deleted. */
  | 'reauth-mismatch'
  /** Account deletion: the server found no recent sign-in on this session
   * (REAUTH_REQUIRED from delete_own_account). Nothing was deleted. */
  | 'reauth-required'
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

/**
 * How the signed-in account may prove it is its owner before deletion.
 * `password` means the account has an email sign-in identity, so a
 * password MAY exist - the client can't know that a password is actually
 * set (an emailed-code-only account has the same identity), so it is
 * offered as a choice, never asserted. `providers` are the linked OAuth
 * providers this app supports. `accountId` binds the deletion to the
 * account the dialog was opened for.
 */
export type DeletionOptions = { accountId: string; password: boolean; providers: OAuthProvider[] };

export type DeletionConfirmation = { kind: 'password'; password: string } | { kind: 'oauth'; provider: OAuthProvider };

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
  /** The confirmation choices for the signed-in account; null when there
   * is no usable session (expired / signed out). */
  getDeletionOptions(): Promise<DeletionOptions | null>;
  /**
   * Deletes `expectedUserId` - and only it - after a fresh confirmation of
   * that same account (spec Section 63): its password, or a new sign-in
   * with a linked provider. The confirmation runs on an isolated client,
   * so the app's own session is never replaced. `isStillCurrent` is
   * checked right before the destructive call (the app's account session
   * must not have changed meanwhile). Throws 'cancelled' if the provider
   * sheet was closed, 'reauth-mismatch' for any different account. Does
   * NOT sign the app out - the caller does that after its cleanup.
   */
  deleteAccount(confirmation: DeletionConfirmation, expectedUserId: string, isStillCurrent?: () => boolean): Promise<void>;
  /** Updates the signed-in user's profile fields, returns the updated
   * session. Email changes trigger Supabase's own re-verification flow
   * for the new address. */
  updateProfile(input: { name?: string; email?: string }): Promise<AuthSession>;
  /** Requires the current password (spec Section 59). */
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
};
