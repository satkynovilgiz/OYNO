import { localAuthService } from './LocalAuthService';

export { localAuthService } from './LocalAuthService';
export {
  AuthError,
  type AuthErrorCode,
  type AuthService,
  type AuthSession,
  type AuthUser,
  type SignInInput,
  type SignUpInput,
} from './types';

/** The one place to swap in a real backend later, e.g.:
 *   export const authService: AuthServiceType = supabaseAuthService; */
export const authService = localAuthService;
