import { KeyRound } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconChip, OtpCodeInput } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

type VerifyResetCodeScreenProps = {
  email: string;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (code: string) => void;
};

export function VerifyResetCodeScreen({ email, isSubmitting, error, onSubmit }: VerifyResetCodeScreenProps) {
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (localError && code.length === 8) setLocalError(null);
  }, [code, localError]);

  const handleSubmit = () => {
    if (code.length !== 8) {
      setLocalError('8 сандан турган кодду жазыңыз.');
      return;
    }
    setLocalError(null);
    onSubmit(code);
  };

  const shownError = localError ?? error;

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.content}>
        <IconChip icon={KeyRound} size={64} iconSize={30} color={colors.primary} />

        <View style={styles.textBlock}>
          <Text style={styles.title}>Ырастоо коду</Text>
          <Text style={styles.description}>
            <Text style={styles.emailText}>{email}</Text> дарегине жөнөтүлгөн кодду жазыңыз.
          </Text>
        </View>

        <View style={styles.codeBlock}>
          <OtpCodeInput value={code} onChangeText={setCode} error={!!shownError} autoFocus />
          {shownError ? <Text style={styles.errorText}>{shownError}</Text> : null}
        </View>
      </View>

      <Button label="Ырастоо" onPress={handleSubmit} loading={isSubmitting} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  content: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  textBlock: {
    alignItems: 'center',
    gap: spacing.xxs,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emailText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  codeBlock: {
    width: '100%',
    maxWidth: 360,
    gap: spacing.xs,
  },
  errorText: {
    ...typography.small,
    color: colors.danger,
    textAlign: 'center',
  },
});
