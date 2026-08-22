import { useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';

type OtpCodeInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  /** Supabase's default OTP length for this project - verified live
   * against a real signup email, not assumed (the platform default of 6
   * is configurable per-project under Auth settings). */
  length?: number;
  error?: boolean;
  autoFocus?: boolean;
};

/** Box-per-character code entry (email verification, password reset) - a
 * single invisible TextInput captures real keystrokes/paste/autofill
 * while the boxes just render whatever it currently holds, the standard
 * RN pattern for this since native OS-level per-box focus isn't a real
 * thing. */
export function OtpCodeInput({ value, onChangeText, length = 8, error, autoFocus }: OtpCodeInputProps) {
  const inputRef = useRef<TextInput>(null);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <AnimatedPressable
      style={styles.row}
      onPress={() => inputRef.current?.focus()}
      accessibilityRole="button"
      accessibilityLabel="Ырастоо кодун жазуу"
    >
      {digits.map((digit, i) => (
        <View
          key={i}
          style={[styles.box, i === activeIndex && styles.boxActive, !!error && styles.boxError, !!digit && styles.boxFilled]}
        >
          <TextInput
            value={digit}
            editable={false}
            style={styles.digitText}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </View>
      ))}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        autoFocus={autoFocus}
        maxLength={length}
        style={styles.hiddenInput}
        accessibilityLabel="Ырастоо коду"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
      />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xxs,
  },
  box: {
    flex: 1,
    aspectRatio: 0.62,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: {
    borderColor: colors.primaryMuted,
  },
  boxActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  boxError: {
    borderColor: colors.danger,
  },
  digitText: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
    padding: 0,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
