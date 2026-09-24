import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, TextButton } from '@/components/ui';
import { useFeedbackStore } from '@/store/useFeedbackStore';
import { colors, spacing, typography } from '@/theme';

/**
 * Shown when a link points at something OYNO doesn't have (an old share
 * link, a mistyped deep link, a removed item). Always offers a way back -
 * a cold-opened deep link has no screen underneath to swipe back to.
 */
export function NotFoundState({ message, onPressBack }: { message?: string; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      </View>
      <View style={styles.center}>
        <Text style={styles.message} accessibilityRole="text">
          {message ?? t('common.notFound')}
        </Text>
        <TextButton label={t('feedback.reportProblem')} onPress={() => useFeedbackStore.getState().open({ source: 'not_found' })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
