import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '@/theme';

type ContextActionButtonProps = {
  label: string;
  enabled: boolean;
  onPress: () => void;
};

/** Shared single context-sensitive action button (Section "KOK BORU —
 * CONTROLS": "Do not show PICK UP/STEAL/PASS/THROW/TACKLE/BOOST all at the
 * same time" - one button whose label changes with game state). Large
 * touch target (Section 92). */
export function ContextActionButton({ label, enabled, onPress }: ContextActionButtonProps) {
  return (
    <Pressable
      onPress={enabled ? onPress : undefined}
      style={[styles.button, !enabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 96,
    minHeight: 52,
    borderRadius: 26,
    paddingHorizontal: 18,
    backgroundColor: colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  disabled: {
    opacity: 0.35,
  },
  label: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2B2019',
  },
});
