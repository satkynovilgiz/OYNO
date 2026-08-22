import { supabaseAuthService } from './SupabaseAuthService';

export { supabaseAuthService } from './SupabaseAuthService';
export {
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
export { useAuthCallbackParams } from './useAuthCallbackParams';

export const authService = supabaseAuthService;
