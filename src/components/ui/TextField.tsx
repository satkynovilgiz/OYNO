import { CircleAlert, Eye, EyeOff } from 'lucide-react-native';
import { useEffect, useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';

import { cardRadii, colors, spacing, typography } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string | null;
  /** Calm helper line under the field (e.g. the password rule). Replaced by
   * the error while one is shown. */
  hint?: string | null;
  placeholder?: string;
  /** Renders a show/hide toggle and defaults to obscured text. */
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  /** iOS AutoFill / password managers (e.g. 'emailAddress', 'password',
   * 'newPassword', 'name'). */
  textContentType?: TextInputProps['textContentType'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  /** Keep the keyboard up on return (moving to the next field). */
  submitBehavior?: TextInputProps['submitBehavior'];
  inputRef?: Ref<TextInput>;
  editable?: boolean;
  autoFocus?: boolean;
  /** Child experience: slightly larger text and field. */
  large?: boolean;
  /** Multi-line input (e.g. admin content-editor long-text fields) - grows
   * to numberOfLines instead of the single-line input row. */
  multiline?: boolean;
  numberOfLines?: number;
};

/** Shared labeled input used by auth, Settings and admin: a real visible
 * label (never placeholder-only), 52pt+ field, clear focus / error /
 * disabled states, AutoFill hints, an optional helper line, and errors
 * announced to screen readers when they appear. `secure` adds the
 * show/hide password toggle. */
export function TextField({
  label,
  value,
  onChangeText,
  error,
  hint,
  placeholder,
  secure = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete,
  textContentType,
  returnKeyType,
  onSubmitEditing,
  submitBehavior,
  inputRef,
  editable = true,
  autoFocus,
  large = false,
  multiline = false,
  numberOfLines = 4,
}: TextFieldProps) {
  const { t } = useTranslation();
  const [isObscured, setIsObscured] = useState(secure);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility?.(`${label}: ${error}`);
  }, [error, label]);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, large && styles.labelLarge]}>
        {label}
      </Text>
      <View
        style={[
          styles.inputRow,
          large && styles.inputRowLarge,
          multiline && styles.inputRowMultiline,
          focused && styles.inputRowFocused,
          !!error && styles.inputRowError,
          !editable && styles.inputRowDisabled,
        ]}
      >
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secure && isObscured}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={secure || keyboardType === 'email-address' ? false : undefined}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          submitBehavior={submitBehavior}
          editable={editable}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : undefined}
          style={[styles.input, large && styles.inputLarge, multiline && styles.inputMultiline, !editable && styles.inputDisabled]}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint ?? undefined}
          accessibilityState={{ disabled: !editable }}
        />
        {secure ? (
          <AnimatedPressable
            onPress={() => setIsObscured((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={isObscured ? t('common.showPassword') : t('common.hidePassword')}
            style={styles.toggle}
            hitSlop={6}
          >
            {isObscured ? <Eye size={19} color={colors.textSecondary} strokeWidth={1.9} /> : <EyeOff size={19} color={colors.textSecondary} strokeWidth={1.9} />}
          </AnimatedPressable>
        ) : null}
      </View>
      {error ? (
        <View style={styles.messageRow}>
          <CircleAlert size={14} color={colors.error} strokeWidth={2.25} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  labelLarge: {
    fontSize: 15,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    backgroundColor: colors.surfaceElevated,
    borderRadius: cardRadii.chip,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.sm,
  },
  inputRowLarge: {
    minHeight: 58,
  },
  inputRowFocused: {
    borderColor: colors.primary,
  },
  inputRowError: {
    borderColor: colors.error,
  },
  inputRowDisabled: {
    backgroundColor: colors.surfaceMuted,
  },
  inputRowMultiline: {
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
    // The row's border shows focus; no second browser outline on web.
    ...(Platform.OS === 'web' ? ({ outlineWidth: 0, outlineStyle: 'none' } as object) : null),
  },
  inputLarge: {
    fontSize: 18,
  },
  inputDisabled: {
    color: colors.textMuted,
  },
  inputMultiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  toggle: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  error: {
    ...typography.small,
    color: colors.error,
    flex: 1,
  },
  hint: {
    ...typography.small,
    color: colors.textMuted,
  },
});
