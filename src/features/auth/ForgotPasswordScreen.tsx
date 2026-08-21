import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, TextField } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

type ForgotPasswordScreenProps = {
  onSubmit: (email: string) => Promise<void>;
  isSubmitting: boolean;
  serverError: string | null;
};

export function ForgotPasswordScreen({ onSubmit, isSubmitting, serverError }: ForgotPasswordScreenProps) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Email жазыңыз.');
      return;
    }
    setError(null);
    await onSubmit(email.trim());
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.content}>
        <Text style={styles.title}>Сырсөздү калыбына келтирүү</Text>
        <Text style={styles.description}>
          Аккаунтуңузга байланыштуу email дарегиңизди жазыңыз - ырастоо коду жөнөтүлөт.
        </Text>

        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={error ?? undefined}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoComplete="email"
        />

        {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}
      </View>

      <Button label="Код жөнөтүү" onPress={handleSubmit} loading={isSubmitting} />
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
  serverError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.sm,
  },
});
