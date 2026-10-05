import type { AuthError as SupabaseAuthErrorType, Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { createConfirmationClient, supabase, type ConfirmationClient } from '@/services/supabase/client';

import {
  AuthError,
  type AuthErrorCode,
  type AuthService,
  type AuthSession,
  type AuthUser,
  type DeletionConfirmation,
  type DeletionOptions,
  type OAuthProvider,
  type OAuthSignInResult,
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
 * Uses typed OTP codes, not magic links, for signup confirmation and
 * password reset - see AuthService's doc comment for why (Expo Go can't
 * reliably open a link tapped from an external app; a code sidesteps
 * that entirely). No redirect URL is needed anywhere in this file as a
 * result - Supabase's OTP email/verify flow never leaves the app.
 */

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function mapSupabaseError(error: SupabaseAuthErrorType | { message: string; code?: string } | null): AuthError {
  const code = (error as { code?: string } | null)?.code;
  const message = error?.message ?? '';

  const byCode: Record<string, [AuthErrorCode, string]> = {
    user_already_exists: ['email-taken', 'Бул email башка аккаунтта колдонулган.'],
    email_exists: ['email-taken', 'Бул email башка аккаунтта колдонулган.'],
    invalid_credentials: ['invalid-credentials', 'Email же сырсөз туура эмес.'],
    weak_password: ['weak-password', `Сырсөз кеминде ${MIN_PASSWORD_LENGTH} белгиден турушу керек.`],
    email_not_confirmed: ['not-verified', 'Email дареги ырасталган эмес.'],
    otp_expired: ['invalid-code', 'Коддун мөөнөтү бүттү. Кайра сурап көрүңүз.'],
    invalid_otp: ['invalid-code', 'Код туура эмес.'],
    over_email_send_rate_limit: ['rate-limited', 'Өтө көп аракет. Бир аздан кийин кайра аракет кылыңыз.'],
    over_request_rate_limit: ['rate-limited', 'Өтө көп аракет. Бир аздан кийин кайра аракет кылыңыз.'],
    user_not_found: ['user-not-found', 'Колдонуучу табылган жок.'],
    same_password: ['same-password', 'Жаңы сырсөз азыркыдан айырмаланышы керек.'],
  };

  const name = (error as { name?: string } | null)?.name ?? '';
  if (code && byCode[code]) {
    const [errCode, msg] = byCode[code];
    return new AuthError(errCode, msg);
  }
  // No (or an expired) recovery/verification session - e.g. a reset
  // screen reached after the code's session timed out.
  if (name === 'AuthSessionMissingError' || /session.*(missing|expired)|jwt expired/i.test(message)) {
    return new AuthError('invalid-code', 'Коддун мөөнөтү бүттү. Кайра сурап көрүңүз.');
  }
  // fetch() failures surface as AuthRetryableFetchError / "Failed to fetch"
  // (web) / "Network request failed" (native) - all mean "no connection".
  if (/network|failed to fetch|load failed/i.test(message) || name === 'AuthRetryableFetchError') {
    return new AuthError('network-error', 'Интернет байланышын текшериңиз.');
  }
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

/**
 * The provider sign-in itself: open the provider page in an auth session
 * sheet, then exchange the returned code for a Supabase session (which
 * becomes the client's current session). `ephemeral` (iOS) asks for a
 * private browser session so a deletion confirmation can't silently reuse
 * an existing provider login cookie.
 */
async function providerSession(provider: OAuthProvider, ephemeral: boolean, client: Pick<typeof supabase, 'auth'> = supabase): Promise<Session> {
  // `skipBrowserRedirect` gets back the provider URL instead of Supabase
  // trying (and failing) to redirect a React Native environment there
  // itself - WebBrowser opens it in an in-app sheet/popup and hands the
  // final redirect back to us once the provider is done. A custom
  // scheme (oyno://auth-callback) is what a native build needs, but a
  // browser can't navigate a popup to one at all - on web this has to
  // be a same-origin http(s) URL instead so the opener can read it back.
  const redirectTo = Platform.OS === 'web' ? `${window.location.origin}/auth-callback` : Linking.createURL('auth-callback');
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw mapSupabaseError(error);

  // A popup blocked by the browser, or a provider redirect that can
  // never resolve, must not hang this promise forever - that would
  // leave the sign-in screen's buttons disabled until a hard refresh.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AuthError('cancelled', '')), 3 * 60 * 1000);
  });
  let result: WebBrowser.WebBrowserAuthSessionResult;
  try {
    result = await Promise.race([WebBrowser.openAuthSessionAsync(data.url, redirectTo, ephemeral ? { preferEphemeralSession: true } : undefined), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new AuthError('cancelled', '');
  }
  if (result.type !== 'success' || !result.url) {
    throw new AuthError('unknown', 'Белгисиз ката кетти.');
  }

  const redirectUrl = new URL(result.url);
  const code = redirectUrl.searchParams.get('code');
  if (!code) {
    throw new AuthError('unknown', redirectUrl.searchParams.get('error_description') ?? 'Белгисиз ката кетти.');
  }

  const { data: sessionData, error: exchangeError } = await client.auth.exchangeCodeForSession(code);
  if (exchangeError || !sessionData.session) throw mapSupabaseError(exchangeError);
  return sessionData.session;
}

const OAUTH_PROVIDERS: readonly OAuthProvider[] = ['apple', 'google'];

/** Identity providers linked to the account ('email' = password sign-in). */
export function linkedProviders(user: Pick<User, 'identities' | 'app_metadata'>): string[] {
  const fromIdentities = (user.identities ?? []).map((identity) => identity.provider);
  const fromMetadata = Array.isArray(user.app_metadata?.providers) ? (user.app_metadata.providers as unknown[]).filter((value): value is string => typeof value === 'string') : [];
  return [...new Set([...fromIdentities, ...fromMetadata])];
}

/**
 * Every confirmation this account may use: each linked supported provider,
 * plus password when an email identity exists (a password is possible
 * there, not guaranteed - see DeletionOptions). Null when nothing can
 * confirm the account.
 */
export function deletionOptionsFor(user: Pick<User, 'id' | 'identities' | 'app_metadata' | 'email'>): DeletionOptions | null {
  const linked = linkedProviders(user);
  const password = linked.includes('email') && !!user.email;
  const providers = OAUTH_PROVIDERS.filter((candidate) => linked.includes(candidate));
  return password || providers.length > 0 ? { accountId: user.id, password, providers } : null;
}

const MISSING_FUNCTION = /could not find the function|PGRST202|42883/i;

/** Ends the confirmation client's own session (memory + that one server session). */
async function discard(client: ConfirmationClient): Promise<void> {
  await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
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
      options: { data: { name: name.trim() } },
    });
    if (error) throw mapSupabaseError(error);
    if (!data.user) throw new AuthError('unknown', 'Белгисиз ката кетти.');

    // Supabase returns 200 with a user object that has zero identities
    // (instead of a "this email is taken" error) when the email already
    // belongs to a confirmed account - an anti-enumeration measure. Left
    // undetected, this path was falling through to "verification-required"
    // and telling the user to check for a code that was never sent.
    if (data.user.identities?.length === 0) {
      throw new AuthError('email-taken', 'Бул email башка аккаунтта колдонулган.');
    }

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

  async signInWithOAuth(provider: OAuthProvider): Promise<OAuthSignInResult> {
    const sessionData = { session: await providerSession(provider, false) };
    const { user } = sessionData.session;
    // No auth.users column marks "just created" directly - a fresh account's
    // created_at and last_sign_in_at land within the same request, while a
    // returning user's last_sign_in_at is from a prior session, seconds/
    // days earlier. 10s comfortably covers request latency without ever
    // matching a real prior sign-in.
    const isNewUser = Math.abs(new Date(user.last_sign_in_at ?? user.created_at).getTime() - new Date(user.created_at).getTime()) < 10_000;

    return { session: await toAuthSession(sessionData.session, user), isNewUser };
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  async verifyEmail(email, code) {
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'signup' });
    if (error) throw mapSupabaseError(error);
    if (!data.session || !data.user) throw new AuthError('invalid-code', 'Код туура эмес.');
    return toAuthSession(data.session, data.user);
  },

  async resendVerificationEmail(email) {
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() });
    if (error) throw mapSupabaseError(error);
  },

  async requestPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    if (error) throw mapSupabaseError(error);
  },

  async verifyPasswordResetCode(email, code) {
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'recovery' });
    if (error) throw mapSupabaseError(error);
  },

  async confirmPasswordReset(newPassword) {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new AuthError('weak-password', `Сырсөз кеминде ${MIN_PASSWORD_LENGTH} белгиден турушу керек.`);
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw mapSupabaseError(error);
    // The recovery code's session did its one job (proving email
    // ownership so this password change is allowed) - sign out so the
    // user re-authenticates fresh with the new password rather than
    // silently ending up logged in from the reset flow.
    await supabase.auth.signOut();
  },

  async getDeletionOptions() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return deletionOptionsFor(data.user);
  },

  async deleteAccount(confirmation: DeletionConfirmation, expectedUserId: string, isStillCurrent: () => boolean = () => true) {
    // The app's session must still be the account the dialog was opened for.
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const account = userData?.user;
    if (userError || !account) throw new AuthError('user-not-found', 'Сиз тутумга кирген жоксуз.');
    if (account.id !== expectedUserId) throw new AuthError('reauth-mismatch', '');

    // Confirmation happens on an ISOLATED client: the app's own session is
    // never replaced, so a wrong account signing in here can't reach sync,
    // guest adoption or private-data writes (they all use `supabase`).
    const confirm = createConfirmationClient();
    try {
      let confirmedId: string | null = null;
      if (confirmation.kind === 'password') {
        if (!account.email) throw new AuthError('invalid-credentials', 'Сырсөз туура эмес.');
        const { data, error } = await confirm.auth.signInWithPassword({ email: account.email, password: confirmation.password });
        if (error || !data.user) throw new AuthError('invalid-credentials', 'Сырсөз туура эмес.');
        confirmedId = data.user.id;
      } else {
        // Only a provider this account is really linked to can confirm it.
        if (!linkedProviders(account).includes(confirmation.provider)) throw new AuthError('reauth-mismatch', '');
        // Cancelled/blocked sheet -> AuthError 'cancelled'; nothing exchanged, nothing deleted.
        const fresh = await providerSession(confirmation.provider, true, confirm);
        confirmedId = fresh.user.id;
      }
      if (confirmedId !== expectedUserId) throw new AuthError('reauth-mismatch', '');

      // Immediately before the destructive call: the app must still be on the
      // same account session, and the server must agree who is signed in.
      if (!isStillCurrent()) throw new AuthError('reauth-mismatch', '');
      const { data: again } = await supabase.auth.getUser();
      if (again?.user?.id !== expectedUserId || !isStillCurrent()) throw new AuthError('reauth-mismatch', '');

      // Runs with the CONFIRMATION session's token (a fresh interactive
      // sign-in of exactly this account). The server re-checks that the
      // token's user is p_expected_user_id and that the sign-in is recent
      // (20261005000001_delete_account_binding.sql). Every user-owned table
      // cascades from auth.users.
      let { error: deleteError } = await confirm.rpc('delete_own_account', { p_expected_user_id: expectedUserId });
      if (deleteError && MISSING_FUNCTION.test(`${deleteError.message ?? ''} ${(deleteError as { code?: string }).code ?? ''}`)) {
        // Server without the binding migration yet: the older function. Safe
        // here because this token was just proven to be expectedUserId's.
        ({ error: deleteError } = await confirm.rpc('delete_own_account'));
      }
      if (deleteError) {
        const message = deleteError.message ?? '';
        if (/REAUTH_REQUIRED/.test(message)) throw new AuthError('reauth-required', '');
        if (/ACCOUNT_MISMATCH/.test(message)) throw new AuthError('reauth-mismatch', '');
        throw new AuthError('unknown', 'Аккаунтту өчүрүү мүмкүн болгон жок. Кайра аракет кылыңыз.');
      }
    } finally {
      await discard(confirm);
    }
    // The app's own (now orphaned) session is ended by the caller
    // (useAuthStore), which owns the local account cleanup around it.
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
