import { router, useLocalSearchParams } from 'expo-router';

import { CheckEmailScreen } from '@/features/auth/CheckEmailScreen';
import { useAuthStore } from '@/store/useAuthStore';

export default function VerifyEmailRoute() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const resendVerificationEmail = useAuthStore((state) => state.resendVerificationEmail);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  return (
    <CheckEmailScreen
      title="Email дарегиңизди текшериңиз"
      email={email}
      error={error}
      onResend={() => resendVerificationEmail(email)}
      links={[
        {
          label: 'Email өзгөртүү',
          onPress: () => {
            clearError();
            router.replace('/sign-up');
          },
        },
        {
          label: 'Кирүүгө кайтуу',
          onPress: () => {
            clearError();
            router.replace('/sign-in');
          },
        },
      ]}
    />
  );
}
