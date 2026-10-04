import { Target } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/theme';

/** ONE subtle goal line on the 3D HUD during a practice mission. */
export function PracticeGoalPill({ text }: { text: string | null }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  if (!text) return null;
  return (
    <View pointerEvents="none" style={[styles.pill, { top: insets.top + 64 }]} accessible accessibilityLabel={`${t('practiceAcademy.practiceGoal')}. ${text}`}>
      <Target size={14} color={colors.textOnDark} strokeWidth={2.25} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: 'rgba(19,32,24,0.6)' },
  text: { ...typography.caption, color: colors.textOnDark, fontWeight: '700' },
});
