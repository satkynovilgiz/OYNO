import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

/** Shared right-side hold-to-sprint button (Section 37/46) - exposes
 * `sprintHeld` as a Reanimated shared value the scene reads directly, and
 * fires haptics on press (Section 61). Large touch target (Section 92:
 * 44+pt). */
export function useSprintButton() {
  const sprintHeld = useSharedValue(false);
  return { sprintHeld };
}

type SprintButtonViewProps = {
  sprintHeld: ReturnType<typeof useSprintButton>['sprintHeld'];
  onPressIn?: () => void;
};

export function SprintButtonView({ sprintHeld, onPressIn }: SprintButtonViewProps) {
  const { t } = useTranslation();

  const handlePressIn = useCallback(() => {
    sprintHeld.value = true;
    onPressIn?.();
  }, [sprintHeld, onPressIn]);

  const handlePressOut = useCallback(() => {
    sprintHeld.value = false;
  }, [sprintHeld]);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel={t('games3d.controls.sprint')}
    >
      <Text style={styles.label}>{t('games3d.controls.sprint')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(232,185,61,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2B2019',
  },
});
