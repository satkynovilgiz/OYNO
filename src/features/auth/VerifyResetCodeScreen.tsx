import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, OtpCodeInput, TextButton } from '@/components/ui';
import { spacing } from '@/theme';

import { AuthShell, FormMessage } from './AuthShell';

type VerifyResetCodeScreenProps = {
  email: string;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (code: string) => void;
  onRequestNewCode: () => void;
  onPressBack?: () => void;
};

/** Step 2 of reset: the 8-digit code. Copy stays honest about delivery -
 * the backend doesn't reveal whether an email has an account, so the
 * screen says a code was sent *if* one exists. */
export function VerifyResetCodeScreen({ email, isSubmitting, error, onSubmit, onRequestNewCode, onPressBack }: VerifyResetCodeScreenProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const autoSubmittedCodeRef = useRef<string | null>(null);

  useEffect(() => {
    if (localError && code.length === 8) setLocalError(null);
  }, [code, localError]);

  const handleSubmit = () => {
    if (isSubmitting) return;
    if (code.length !== 8) {
      setLocalError(t('auth.verifyResetCode.codeError'));
      return;
    }
    setLocalError(null);
    onSubmit(code);
  };

  // Auto-submit once all 8 digits are entered; the button stays as the
  // retry path after a failed attempt (the code is left unchanged).
  useEffect(() => {
    if (code.length === 8 && code !== autoSubmittedCodeRef.current && !isSubmitting) {
      autoSubmittedCodeRef.current = code;
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, isSubmitting]);

  return (
    <AuthShell hero="compact" title={t('auth.verifyResetCode.title')} subtitle={t('auth.v2.resetCode.subtitle', { email })} onPressBack={onPressBack}>
      <View style={styles.code}>
        <OtpCodeInput value={code} onChangeText={setCode} error={!!(localError ?? error)} autoFocus />
      </View>
      <FormMessage tone="error" message={localError ?? error} />
      <Button label={t('auth.verifyResetCode.submit')} size="lg" block onPress={handleSubmit} loading={isSubmitting} />
      <TextButton label={t('auth.v2.resetCode.newCode')} onPress={onRequestNewCode} tone="muted" style={styles.center} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  code: { alignSelf: 'stretch', maxWidth: 380, width: '100%', marginTop: spacing.xs },
  center: { alignSelf: 'center' },
});
