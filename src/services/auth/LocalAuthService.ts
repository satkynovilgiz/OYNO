import * as Crypto from 'expo-crypto';

import { secureStorage } from './secureStorage';
import {
  AuthError,
  type AuthService,
  type AuthSession,
  type AuthUser,
  type SignInInput,
  type SignUpInput,
} from './types';

/**
 * Local, on-device auth implementation. There is no backend connected to
 * this app yet (no Supabase project/credentials were available when this
 * was built - see PROGRESS_AUDIT.md) - this exists so the rest of the app
 * (screens, navigation guards, the auth store) can be built against a real
 * AuthService contract now, instead of blocking on backend provisioning.
 *
 * This is NOT production-secure and isn't meant to be:
 *   - Passwords are hashed (SHA-256 + a random per-user salt) rather than
 *     stored in plaintext, but there's no pepper/server secret and no rate
 *     limiting - a real backend (e.g. Supabase Auth) must replace this
 *     before shipping to real users.
 *   - "Password reset" has no email delivery, so the verification code is
 *     handed straight back to the UI to display (see the doc comment on
 *     requestPasswordReset). A real backend would email it instead.
 *   - There's no server-side validation of anything - client and "server"
 *     are the same device.
 *
 * Swap-in plan: implement `AuthService` again as `SupabaseAuthService` and
 * change one import in `src/store/useAuthStore.ts`. Nothing else (screens,
 * navigation, the store's own API) should need to change.
 */

const USERS_KEY = 'oyno.auth.users';
const SESSION_KEY = 'oyno.auth.session';
const RESET_CODES_KEY = 'oyno.auth.resetCodes';

type StoredUser = AuthUser & { passwordHash: string; passwordSalt: string };
type ResetCode = { code: string; expiresAt: number };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

async function hashPassword(password: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
}

async function readUsers(): Promise<Record<string, StoredUser>> {
  const raw = await secureStorage.getItem(USERS_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function writeUsers(users: Record<string, StoredUser>): Promise<void> {
  await secureStorage.setItem(USERS_KEY, JSON.stringify(users));
}

async function readResetCodes(): Promise<Record<string, ResetCode>> {
  const raw = await secureStorage.getItem(RESET_CODES_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function writeResetCodes(codes: Record<string, ResetCode>): Promise<void> {
  await secureStorage.setItem(RESET_CODES_KEY, JSON.stringify(codes));
}

function toPublicUser(stored: StoredUser): AuthUser {
  const { passwordHash: _hash, passwordSalt: _salt, ...user } = stored;
  return user;
}

async function persistSession(session: AuthSession): Promise<void> {
  await secureStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export const localAuthService: AuthService = {
  async getSession() {
    const raw = await secureStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  },

  async signUp({ name, email, password }: SignUpInput) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      throw new AuthError('invalid-email', 'Email туура эмес.');
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new AuthError('weak-password', `Сырсөз кеминде ${MIN_PASSWORD_LENGTH} белгиден турушу керек.`);
    }

    const users = await readUsers();
    if (users[normalizedEmail]) {
      throw new AuthError('email-taken', 'Бул email менен аккаунт мурунтан эле бар.');
    }

    const salt = Crypto.randomUUID();
    const passwordHash = await hashPassword(password, salt);
    const user: StoredUser = {
      id: Crypto.randomUUID(),
      name: name.trim(),
      email: normalizedEmail,
      createdAt: new Date().toISOString(),
      passwordHash,
      passwordSalt: salt,
    };
    users[normalizedEmail] = user;
    await writeUsers(users);

    const session: AuthSession = { user: toPublicUser(user), token: Crypto.randomUUID() };
    await persistSession(session);
    return session;
  },

  async signIn({ email, password }: SignInInput) {
    const normalizedEmail = email.trim().toLowerCase();
    const users = await readUsers();
    const user = users[normalizedEmail];
    if (!user) {
      throw new AuthError('invalid-credentials', 'Email же сырсөз туура эмес.');
    }
    const candidateHash = await hashPassword(password, user.passwordSalt);
    if (candidateHash !== user.passwordHash) {
      throw new AuthError('invalid-credentials', 'Email же сырсөз туура эмес.');
    }

    const session: AuthSession = { user: toPublicUser(user), token: Crypto.randomUUID() };
    await persistSession(session);
    return session;
  },

  async signOut() {
    await secureStorage.removeItem(SESSION_KEY);
  },

  async requestPasswordReset(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const users = await readUsers();
    if (!users[normalizedEmail]) {
      // A real backend should NOT reveal whether an email is registered.
      // This local dev service does, purely so the reset flow is testable
      // without a real inbox - do not carry this behavior into a real
      // backend implementation.
      throw new AuthError('user-not-found', 'Бул email менен аккаунт табылган жок.');
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codes = await readResetCodes();
    codes[normalizedEmail] = { code, expiresAt: Date.now() + 10 * 60 * 1000 };
    await writeResetCodes(codes);

    return { demoCode: code };
  },

  async confirmPasswordReset(email: string, code: string, newPassword: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const codes = await readResetCodes();
    const entry = codes[normalizedEmail];
    if (!entry || entry.code !== code || entry.expiresAt < Date.now()) {
      throw new AuthError('invalid-reset-code', 'Код туура эмес же мөөнөтү бүткөн.');
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new AuthError('weak-password', `Сырсөз кеминде ${MIN_PASSWORD_LENGTH} белгиден турушу керек.`);
    }

    const users = await readUsers();
    const user = users[normalizedEmail];
    if (!user) {
      throw new AuthError('user-not-found', 'Бул email менен аккаунт табылган жок.');
    }

    const salt = Crypto.randomUUID();
    user.passwordSalt = salt;
    user.passwordHash = await hashPassword(newPassword, salt);
    users[normalizedEmail] = user;
    await writeUsers(users);

    delete codes[normalizedEmail];
    await writeResetCodes(codes);
  },

  async deleteAccount() {
    const raw = await secureStorage.getItem(SESSION_KEY);
    const session = raw ? (JSON.parse(raw) as AuthSession) : null;
    if (!session) return;

    const users = await readUsers();
    delete users[session.user.email];
    await writeUsers(users);
    await secureStorage.removeItem(SESSION_KEY);
  },
};
