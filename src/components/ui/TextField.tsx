import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string | null;
  placeholder?: string;
  /** Renders a show/hide toggle and defaults to obscured text. */
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  /** Multi-line input (e.g. admin content-editor long-text fields) - grows
   * to numberOfLines instead of the single-line input row. */
  multiline?: boolean;
  numberOfLines?: number;
};

/** Shared labeled input with inline validation error, used across Sign Up /
 * Sign In / Forgot Password. Doubles as the PasswordInput from the
 * component list via `secure` rather than a separate near-duplicate. */
export function TextField({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  secure = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete,
  multiline = false,
  numberOfLines = 4,
}: TextFieldProps) {
  const [isObscured, setIsObscured] = useState(secure);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, multiline && styles.inputRowMultiline, !!error && styles.inputRowError]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secure && isObscured}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : undefined}
          style={[styles.input, multiline && styles.inputMultiline]}
          accessibilityLabel={label}
        />
        {secure ? (
          <AnimatedPressable
            onPress={() => setIsObscured((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={isObscured ? 'Сырсөздү көрсөтүү' : 'Сырсөздү жашыруу'}
            style={styles.toggle}
          >
            {isObscured ? (
              <Eye size={18} color={colors.textSecondary} strokeWidth={1.75} />
            ) : (
              <EyeOff size={18} color={colors.textSecondary} strokeWidth={1.75} />
            )}
          </AnimatedPressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xxs,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.sm,
  },
  inputRowError: {
    borderColor: colors.danger,
  },
  inputRowMultiline: {
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
  },
  inputMultiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  toggle: {
    padding: spacing.xxs,
  },
  error: {
    ...typography.small,
    color: colors.danger,
  },
});
