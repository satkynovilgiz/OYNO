import { supabaseAuthService } from './SupabaseAuthService';

export { supabaseAuthService } from './SupabaseAuthService';
export {
  AuthError,
  type AuthErrorCode,
  type AuthService,
  type AuthSession,
  type AuthUser,
  type OAuthProvider,
  type OAuthSignInResult,
  type SignInInput,
  type SignUpInput,
  type SignUpResult,
} from './types';

export const authService = supabaseAuthService;
