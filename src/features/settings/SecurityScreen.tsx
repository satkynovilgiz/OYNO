import { Laptop2, LogOut } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, TextField } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

import { SettingsScreenLayout } from './components/SettingsScreenLayout';

type SecurityScreenProps = {
  isSubmitting: boolean;
  error: string | null;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  onSignOutAllSessions: () => Promise<void>;
  onPressBack: () => void;
};

export function SecurityScreen({ isSubmitting, error, onChangePassword, onSignOutAllSessions, onPressBack }: SecurityScreenProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSubmit = async () => {
    setSavedNotice(false);
    const errors: typeof fieldErrors = {};
    if (newPassword.length < 8) errors.newPassword = 'Сырсөз кеминде 8 белгиден турушу керек.';
    if (confirmPassword !== newPassword) errors.confirmPassword = 'Сырсөздөр дал келбейт.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const ok = await onChangePassword(currentPassword, newPassword);
    if (ok) {
      setSavedNotice(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <SettingsScreenLayout title="Коопсуздук" onPressBack={onPressBack}>
      <View style={styles.form}>
        <Text style={styles.sectionTitle}>Сырсөздү өзгөртүү</Text>
        <TextField label="Учурдагы сырсөз" value={currentPassword} onChangeText={setCurrentPassword} secure />
        <TextField label="Жаңы сырсөз" value={newPassword} onChangeText={setNewPassword} error={fieldErrors.newPassword} secure />
        <TextField
          label="Жаңы сырсөздү ырастоо"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={fieldErrors.confirmPassword}
          secure
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {savedNotice ? <Text style={styles.saved}>Сырсөз өзгөртүлдү ✓</Text> : null}
        <Button label="Сырсөздү өзгөртүү" onPress={handleSubmit} loading={isSubmitting} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Активдүү сессиялар</Text>
        <View style={styles.sessionCard}>
          <View style={styles.sessionIconWrap}>
            <Laptop2 size={20} color={colors.primary} strokeWidth={1.75} />
          </View>
          <View style={styles.sessionBody}>
            <Text style={styles.sessionTitle}>Бул түзмөк</Text>
            <Text style={styles.sessionMeta}>
              Учурда башка түзмөктөрдөгү сессияларды көрсөтүү жеткиликсиз - бул функция үчүн серверлик колдоо
              керек.
            </Text>
          </View>
        </View>

        <Button
          label="Бардык сессиялардан чыгуу"
          variant="secondary"
          icon={<LogOut size={16} color={colors.primary} strokeWidth={2} />}
          onPress={onSignOutAllSessions}
        />
      </View>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
  saved: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  section: {
    gap: spacing.sm,
  },
  sessionCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.sm,
  },
  sessionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionBody: {
    flex: 1,
    gap: 2,
  },
  sessionTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  sessionMeta: {
    ...typography.small,
    color: colors.textSecondary,
  },
});
