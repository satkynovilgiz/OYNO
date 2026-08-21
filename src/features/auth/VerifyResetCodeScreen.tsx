import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, TextField } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

type VerifyResetCodeScreenProps = {
  email: string;
  /** There's no email delivery without a real backend (see
   * LocalAuthService's doc comment) - the demo code is shown directly here
   * instead of silently pretending an email was sent. */
  demoCode: string;
  onSubmit: (code: string) => void;
  error: string | null;
};

export function VerifyResetCodeScreen({ email, demoCode, onSubmit, error }: VerifyResetCodeScreenProps) {
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (code.trim().length !== 6) {
      setLocalError('6 сандан турган кодду жазыңыз.');
      return;
    }
    setLocalError(null);
    onSubmit(code.trim());
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.content}>
        <Text style={styles.title}>Ырастоо коду</Text>
        <Text style={styles.description}>{email} дарегине жөнөтүлгөн кодду жазыңыз.</Text>

        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>
            Демо режим: чыныгы email кызматы жок, ошондуктан код бул жерде көрсөтүлөт: {'\n'}
            <Text style={styles.demoCode}>{demoCode}</Text>
          </Text>
        </View>

        <TextField
          label="Код"
          value={code}
          onChangeText={setCode}
          error={localError ?? error ?? undefined}
          placeholder="123456"
          keyboardType="number-pad"
        />
      </View>

      <Button label="Ырастоо" onPress={handleSubmit} />
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
    gap: spacing.md,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
  },
  demoBanner: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing.sm,
  },
  demoBannerText: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  demoCode: {
    ...typography.bodyBold,
    color: colors.primary,
  },
});
