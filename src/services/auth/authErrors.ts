import i18n from '@/i18n';
import { AuthError, type AuthErrorCode } from './types';

/**
 * Where an auth error happened - the same backend code can mean different
 * things to a person (invalid-credentials at sign-in = "email or password
 * is wrong"; while deleting the account = "that password is wrong").
 */
export type AuthErrorContext = 'signIn' | 'signUp' | 'verify' | 'reset' | 'account';

/**
 * Maps a typed auth failure to an i18n key. Raw backend/exception text is
 * never shown (it's English-only, technical, and can echo input back).
 */
export function authErrorKey(error: unknown, context: AuthErrorContext = 'signIn'): string {
  const code: AuthErrorCode = error instanceof AuthError ? error.code : 'unknown';
  switch (code) {
    case 'invalid-credentials':
      return context === 'account' ? 'auth.v2.errors.wrongPassword' : 'auth.v2.errors.invalidCredentials';
    case 'email-taken':
      return 'auth.v2.errors.emailTaken';
    case 'weak-password':
      return 'auth.v2.errors.passwordShort';
    case 'same-password':
      return 'auth.v2.errors.samePassword';
    case 'invalid-email':
      return 'auth.v2.errors.emailInvalid';
    case 'not-verified':
      return 'auth.v2.errors.notVerified';
    case 'invalid-code':
      return context === 'reset' ? 'auth.v2.errors.invalidResetCode' : 'auth.v2.errors.invalidCode';
    case 'rate-limited':
      return 'auth.v2.errors.rateLimited';
    case 'network-error':
      return 'auth.v2.errors.offline';
    case 'user-not-found':
      return context === 'account' ? 'auth.v2.errors.sessionEnded' : 'auth.v2.errors.invalidCredentials';
    default:
      return 'auth.v2.errors.unknown';
  }
}

/** Localized message for the current app language. */
export function localizeAuthError(error: unknown, context?: AuthErrorContext): string {
  return i18n.t(authErrorKey(error, context));
}
