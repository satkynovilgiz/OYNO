/**
 * Client-side checks that mirror the backend's own rules - nothing
 * stricter: Supabase requires a valid email and (this project) a password
 * of at least 8 characters. Returns i18n keys, never raw text, so every
 * message is localized at render time.
 */
export const MIN_PASSWORD_LENGTH = 8;

/** An address format, not copy - the same in every language. */
export const EMAIL_PLACEHOLDER = 'name@example.com';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim();
}

export function emailError(email: string): string | null {
  const value = normalizeEmail(email);
  if (!value) return 'auth.v2.errors.emailRequired';
  if (!EMAIL_PATTERN.test(value)) return 'auth.v2.errors.emailInvalid';
  return null;
}

/** Sign-in only needs *a* password - an old account may predate today's
 * length rule, and the server is the judge of whether it is right. */
export function signInPasswordError(password: string): string | null {
  return password ? null : 'auth.v2.errors.passwordRequired';
}

export function newPasswordError(password: string): string | null {
  if (!password) return 'auth.v2.errors.passwordRequired';
  if (password.length < MIN_PASSWORD_LENGTH) return 'auth.v2.errors.passwordShort';
  return null;
}

export function nameError(name: string): string | null {
  return name.trim() ? null : 'auth.v2.errors.nameRequired';
}

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export function validateSignIn(input: { email: string; password: string }): FieldErrors<'email' | 'password'> {
  return compact({ email: emailError(input.email), password: signInPasswordError(input.password) });
}

export function validateSignUp(input: { name: string; email: string; password: string }): FieldErrors<'name' | 'email' | 'password'> {
  return compact({ name: nameError(input.name), email: emailError(input.email), password: newPasswordError(input.password) });
}

export function validateNewPassword(input: { password: string; confirmPassword: string }): FieldErrors<'password' | 'confirmPassword'> {
  return compact({
    password: newPasswordError(input.password),
    confirmPassword: input.password && input.confirmPassword !== input.password ? 'auth.v2.errors.passwordMismatch' : null,
  });
}

function compact<K extends string>(errors: Record<K, string | null>): FieldErrors<K> {
  const result: FieldErrors<K> = {};
  for (const key of Object.keys(errors) as K[]) if (errors[key]) result[key] = errors[key]!;
  return result;
}
