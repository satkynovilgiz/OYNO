import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, TextField } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

type SignInScreenProps = {
  onSubmit: (input: { email: string; password: string }) => Promise<boolean>;
  isSubmitting: boolean;
  serverError: string | null;
  onPressSignUp: () => void;
  onPressForgotPassword: () => void;
};

export function SignInScreen({ onSubmit, isSubmitting, serverError, onPressSignUp, onPressForgotPassword }: SignInScreenProps) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = (): boolean => {
    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) nextErrors.email = 'Email жазыңыз.';
    if (!password) nextErrors.password = 'Сырсөздү жазыңыз.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await onSubmit({ email: email.trim(), password });
  };

  const handleUnavailableProvider = (provider: string) => {
    Alert.alert('Жеткиликтүү эмес', `${provider} аркылуу кирүү азырынча жеткиликтүү эмес.`);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Кирүү</Text>

      <View style={styles.form}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextField label="Сырсөз" value={password} onChangeText={setPassword} error={errors.password} secure autoComplete="password" />

        <Text style={styles.forgotLink} onPress={onPressForgotPassword}>
          Сырсөздү унуттуңузбу?
        </Text>

        {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

        <Button label="Кирүү" onPress={handleSubmit} loading={isSubmitting} />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>же</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button label="Google менен улантуу" variant="secondary" onPress={() => handleUnavailableProvider('Google')} />
        <Button label="Apple менен улантуу" variant="secondary" onPress={() => handleUnavailableProvider('Apple')} />
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>Аккаунтуңуз жокпу?</Text>
        <Text style={styles.footerLink} onPress={onPressSignUp}>
          Катталуу
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
  },
  form: {
    gap: spacing.md,
  },
  forgotLink: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'right',
  },
  serverError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.surfaceBorder,
  },
  dividerText: {
    ...typography.small,
    color: colors.textMuted,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  footerText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  footerLink: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
});
