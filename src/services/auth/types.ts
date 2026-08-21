export type AuthUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export type AuthSession = {
  user: AuthUser;
  /** Opaque local session token. Stands in for a real backend session/JWT -
   * see AuthService.ts for why there's no real one yet. */
  token: string;
};

export type AuthErrorCode =
  | 'invalid-email'
  | 'weak-password'
  | 'password-mismatch'
  | 'email-taken'
  | 'invalid-credentials'
  | 'user-not-found'
  | 'invalid-reset-code'
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

/**
 * Backend-agnostic auth contract. `LocalAuthService` is the only
 * implementation right now (see its own doc comment for why); a future
 * `SupabaseAuthService` implementing this same interface is a drop-in
 * replacement - nothing above the service layer (the store, screens) should
 * need to change.
 */
export type AuthService = {
  getSession(): Promise<AuthSession | null>;
  signUp(input: SignUpInput): Promise<AuthSession>;
  signIn(input: SignInInput): Promise<AuthSession>;
  signOut(): Promise<void>;
  /** Starts a password reset; returns the demo verification code so the UI
   * can display it (see LocalAuthService doc comment - there's no email
   * delivery without a real backend). */
  requestPasswordReset(email: string): Promise<{ demoCode: string }>;
  confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void>;
  deleteAccount(): Promise<void>;
};
