import type { AuthError as SupabaseAuthErrorType, Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

import { supabase } from '@/services/supabase/client';

import {
  AuthError,
  type AuthErrorCode,
  type AuthService,
  type AuthSession,
  type AuthUser,
  type EmailLinkParams,
  type SignInInput,
  type SignUpInput,
  type SignUpResult,
} from './types';

/**
 * Real backend auth, implementing the same `AuthService` contract
 * `LocalAuthService` used to (see git history / BACKEND_PLAN.md - it was
 * retired once this existed, its whole reason for existing was standing
 * in for exactly this). Session persistence, token refresh, email
 * verification, and password-reset delivery are all real Supabase Auth
 * behavior now, not a device-local simulation of it.
 *
 * Uses magic links, not typed OTP codes, for signup confirmation and
 * password reset - Supabase locks email-template customization (needed to
 * show a typed code) behind configuring a custom SMTP provider, which is
 * a real external-service decision left to whoever runs this project, not
 * something to force through in code. See BACKEND_PLAN.md.
 */

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `Linking.createURL` (not a hand-rolled `oyno://` string) because the
 * correct redirect URL genuinely differs by environment: a real
 * `oyno://` scheme link in a standalone/dev-client build, an `exp://
 * <lan-ip>:8081/--/<path>` link when running in Expo Go (Expo Go owns the
 * OS-level `oyno://` registration, not this app, so a hardcoded
 * `oyno://` link silently fails to open correctly there - this is the
 * actual bug behind a real "verification failed" the user hit testing
 * through Expo Go), and the current origin on web. All three must be
 * covered in the project's Auth > URL Configuration > Redirect URLs
 * allow-list - `exp://**` in addition to `oyno://**` and the web origin.
 */
function getRedirectUrl(path: string): string {
  return Linking.createURL(path);
}

function mapSupabaseError(error: SupabaseAuthErrorType | { message: string; code?: string } | null): AuthError {
  const code = (error as { code?: string } | null)?.code;
  const message = error?.message ?? '';

  const byCode: Record<string, [AuthErrorCode, string]> = {
    user_already_exists: ['email-taken', 'Бул email башка аккаунтта колдонулган.'],
    email_exists: ['email-taken', 'Бул email башка аккаунтта колдонулган.'],
    invalid_credentials: ['invalid-credentials', 'Email же сырсөз туура эмес.'],
    weak_password: ['weak-password', `Сырсөз кеминде ${MIN_PASSWORD_LENGTH} белгиден турушу керек.`],
    email_not_confirmed: ['not-verified', 'Email дареги ырасталган эмес.'],
    otp_expired: ['invalid-link', 'Шилтеменин мөөнөтү бүттү. Кайра сурап көрүңүз.'],
    invalid_otp: ['invalid-link', 'Шилтеме жараксыз.'],
    over_email_send_rate_limit: ['rate-limited', 'Өтө көп аракет. Бир аздан кийин кайра аракет кылыңыз.'],
    over_request_rate_limit: ['rate-limited', 'Өтө көп аракет. Бир аздан кийин кайра аракет кылыңыз.'],
    user_not_found: ['user-not-found', 'Колдонуучу табылган жок.'],
    same_password: ['weak-password', 'Жаңы сырсөз азыркыдан айырмаланышы керек.'],
  };

  if (code && byCode[code]) {
    const [errCode, msg] = byCode[code];
    return new AuthError(errCode, msg);
  }
  if (/network/i.test(message)) return new AuthError('network-error', 'Интернет байланышын текшериңиз.');
  if (/invalid.*(email|credentials)|credentials/i.test(message)) {
    return new AuthError('invalid-credentials', 'Email же сырсөз туура эмес.');
  }
  if (/already registered|already exists/i.test(message)) {
    return new AuthError('email-taken', 'Бул email башка аккаунтта колдонулган.');
  }
  if (/rate limit/i.test(message)) return new AuthError('rate-limited', 'Өтө көп аракет. Бир аздан кийин кайра аракет кылыңыз.');
  return new AuthError('unknown', 'Белгисиз ката кетти.');
}

async function fetchProfileName(userId: string, fallback: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('name').eq('id', userId).maybeSingle();
  return data?.name ?? fallback;
}

async function toAuthSession(session: Session, user: User): Promise<AuthSession> {
  const name = await fetchProfileName(user.id, user.email?.split('@')[0] ?? 'OYNO');
  const authUser: AuthUser = {
    id: user.id,
    name,
    email: user.email ?? '',
    createdAt: user.created_at,
  };
  return { user: authUser, token: session.access_token };
}

export const supabaseAuthService: AuthService = {
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return null;
    return toAuthSession(data.session, data.session.user);
  },

  async signUp({ name, email, password }: SignUpInput): Promise<SignUpResult> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      throw new AuthError('invalid-email', 'Email туура эмес.');
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new AuthError('weak-password', `Сырсөз кеминде ${MIN_PASSWORD_LENGTH} белгиден турушу керек.`);
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { data: { name: name.trim() }, emailRedirectTo: getRedirectUrl('auth-callback-signup') },
    });
    if (error) throw mapSupabaseError(error);
    if (!data.user) throw new AuthError('unknown', 'Белгисиз ката кетти.');

    if (data.session) {
      // Only happens if the project has "Confirm email" turned off.
      return { status: 'signed-in', session: await toAuthSession(data.session, data.user) };
    }
    return { status: 'verification-required', email: normalizedEmail };
  },

  async signIn({ email, password }: SignInInput) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw mapSupabaseError(error);
    if (!data.session) throw new AuthError('unknown', 'Белгисиз ката кетти.');
    return toAuthSession(data.session, data.user);
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  async resendVerificationEmail(email) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: getRedirectUrl('auth-callback-signup') },
    });
    if (error) throw mapSupabaseError(error);
  },

  async requestPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: getRedirectUrl('auth-callback-recovery'),
    });
    if (error) throw mapSupabaseError(error);
  },

  async completeFromEmailLink(params: EmailLinkParams) {
    if ('code' in params) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
      if (error) throw mapSupabaseError(error);
      if (!data.session || !data.user) throw new AuthError('invalid-link', 'Шилтеме жараксыз.');
      return toAuthSession(data.session, data.user);
    }
    const { data, error } = await supabase.auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    });
    if (error) throw mapSupabaseError(error);
    if (!data.session || !data.user) throw new AuthError('invalid-link', 'Шилтеме жараксыз.');
    return toAuthSession(data.session, data.user);
  },

  async confirmPasswordReset(newPassword) {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new AuthError('weak-password', `Сырсөз кеминде ${MIN_PASSWORD_LENGTH} белгиден турушу керек.`);
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw mapSupabaseError(error);
    // The recovery link's session did its one job (proving email
    // ownership so this password change is allowed) - sign out so the
    // user re-authenticates fresh with the new password rather than
    // silently ending up logged in from a link they got over email.
    await supabase.auth.signOut();
  },

  async deleteAccount(password) {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;
    if (!email) throw new AuthError('user-not-found', 'Сиз тутумга кирген жоксуз.');

    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password });
    if (verifyError) throw new AuthError('invalid-credentials', 'Сырсөз туура эмес.');

    // The client can delete its own profile row (RLS allows it), but
    // cannot delete the underlying auth.users record - that requires the
    // service role, which never runs on-device. See BACKEND_PLAN.md: full
    // hard-deletion needs a service-role Edge Function (not built this
    // pass). This still removes the user's actual app data and signs them
    // out; it's the honest subset of "delete account" this client can do
    // on its own.
    if (userData.user) {
      await supabase.from('profiles').delete().eq('id', userData.user.id);
    }
    await supabase.auth.signOut();
  },

  async updateProfile({ name, email }) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) throw new AuthError('user-not-found', 'Сиз тутумга кирген жоксуз.');

    if (name?.trim()) {
      const { error } = await supabase.from('profiles').update({ name: name.trim() }).eq('id', userData.user.id);
      if (error) throw new AuthError('unknown', 'Белгисиз ката кетти.');
    }

    if (email && email.trim().toLowerCase() !== userData.user.email) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!EMAIL_PATTERN.test(normalizedEmail)) {
        throw new AuthError('invalid-email', 'Email туура эмес.');
      }
      // Supabase requires re-confirming a changed email before it takes
      // effect - the session's email won't reflect this until that
      // happens, unlike LocalAuthService's old immediate-change behavior.
      const { error } = await supabase.auth.updateUser({ email: normalizedEmail });
      if (error) throw mapSupabaseError(error);
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) throw new AuthError('user-not-found', 'Сиз тутумга кирген жоксуз.');
    return toAuthSession(sessionData.session, sessionData.session.user);
  },

  async changePassword(currentPassword, newPassword) {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;
    if (!email) throw new AuthError('user-not-found', 'Сиз тутумга кирген жоксуз.');
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new AuthError('weak-password', `Сырсөз кеминде ${MIN_PASSWORD_LENGTH} белгиден турушу керек.`);
    }

    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (verifyError) throw new AuthError('invalid-credentials', 'Учурдагы сырсөз туура эмес.');

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw mapSupabaseError(error);
  },
};
