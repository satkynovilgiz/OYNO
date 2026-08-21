import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, TextField } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

type FieldErrors = Partial<Record<'name' | 'email' | 'password' | 'confirmPassword', string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

type SignUpScreenProps = {
  onSubmit: (input: { name: string; email: string; password: string }) => Promise<boolean>;
  isSubmitting: boolean;
  serverError: string | null;
  onPressSignIn: () => void;
};

export function SignUpScreen({ onSubmit, isSubmitting, serverError, onPressSignIn }: SignUpScreenProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = (): boolean => {
    const nextErrors: FieldErrors = {};
    if (!name.trim()) nextErrors.name = 'Атыңызды жазыңыз.';
    if (!EMAIL_PATTERN.test(email.trim())) nextErrors.email = 'Email туура эмес.';
    if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `Сырсөз кеминде ${MIN_PASSWORD_LENGTH} белгиден турушу керек.`;
    }
    if (confirmPassword !== password) nextErrors.confirmPassword = 'Сырсөздөр дал келбейт.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await onSubmit({ name: name.trim(), email: email.trim(), password });
  };

  const handleUnavailableProvider = (provider: string) => {
    Alert.alert('Жеткиликтүү эмес', `${provider} аркылуу катталуу азырынча жеткиликтүү эмес.`);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Катталуу</Text>

      <View style={styles.form}>
        <TextField label="Аты-жөнү" value={name} onChangeText={setName} error={errors.name} placeholder="Бек Асанов" />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextField label="Сырсөз" value={password} onChangeText={setPassword} error={errors.password} secure autoComplete="password-new" />
        <TextField
          label="Сырсөздү ырастоо"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={errors.confirmPassword}
          secure
        />

        {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

        <Button label="Катталуу" onPress={handleSubmit} loading={isSubmitting} />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>же</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button label="Google менен улантуу" variant="secondary" onPress={() => handleUnavailableProvider('Google')} />
        <Button label="Apple менен улантуу" variant="secondary" onPress={() => handleUnavailableProvider('Apple')} />
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>Аккаунтуңуз барбы?</Text>
        <Text style={styles.footerLink} onPress={onPressSignIn}>
          Кирүү
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
  serverError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
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
