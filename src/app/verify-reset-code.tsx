import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { VerifyResetCodeScreen } from '@/features/auth/VerifyResetCodeScreen';

export default function VerifyResetCodeRoute() {
  const { email, demoCode } = useLocalSearchParams<{ email: string; demoCode: string }>();
  const [error, setError] = useState<string | null>(null);

  return (
    <VerifyResetCodeScreen
      email={email}
      demoCode={demoCode}
      error={error}
      onSubmit={(code) => {
        if (code !== demoCode) {
          setError('Код туура эмес.');
          return;
        }
        setError(null);
        router.push({ pathname: '/reset-password', params: { email, code } });
      }}
    />
  );
}
