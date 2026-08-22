import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { CheckEmailScreen } from '@/features/auth/CheckEmailScreen';
import { authService, AuthError } from '@/services/auth';

export default function ResetPasswordSentRoute() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [error, setError] = useState<string | null>(null);

  return (
    <CheckEmailScreen
      title="Сырсөздү калыбына келтирүү"
      email={email}
      error={error}
      onResend={async () => {
        setError(null);
        try {
          await authService.requestPasswordReset(email);
          return true;
        } catch (err) {
          setError(err instanceof AuthError ? err.message : 'Белгисиз ката кетти.');
          return false;
        }
      }}
      links={[{ label: 'Кирүүгө кайтуу', onPress: () => router.replace('/sign-in') }]}
    />
  );
}
