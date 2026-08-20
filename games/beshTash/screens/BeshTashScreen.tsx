import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

import { BeshTashBoard } from '../components/BeshTashBoard';
import { useBeshTashGame } from '../hooks/useBeshTashGame';

type BeshTashScreenProps = {
  onPressBack?: () => void;
};

export function BeshTashScreen({ onPressBack }: BeshTashScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { state, isAttempting, liftProgress, ringProgress, sweetSpotFraction, onPressAction, restart } =
    useBeshTashGame();

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <IconButton
          icon={ChevronLeft}
          shape="roundedSquare"
          accessibilityLabel={t('beshTash.back')}
          onPress={onPressBack}
        />
        <Text style={styles.title}>{t('beshTash.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {state.status === 'idle' && (
          <View style={styles.centerBlock}>
            <Button label={t('beshTash.start')} onPress={restart} />
          </View>
        )}

        {(state.status === 'in-progress' || state.status === 'won' || state.status === 'failed') && (
          <BeshTashBoard
            state={state}
            isAttempting={isAttempting}
            liftProgress={liftProgress}
            ringProgress={ringProgress}
            sweetSpotFraction={sweetSpotFraction}
            onPressAction={onPressAction}
          />
        )}

        {state.status === 'won' && (
          <View style={styles.overlay}>
            <Text style={styles.overlayTitle}>{t('beshTash.wonTitle')}</Text>
            <Text style={styles.overlaySubtitle}>{t('beshTash.wonSubtitle')}</Text>
            <Button label={t('beshTash.restart')} onPress={restart} />
          </View>
        )}

        {state.status === 'failed' && (
          <View style={styles.overlay}>
            <Text style={styles.overlayTitle}>{t('beshTash.failedTitle')}</Text>
            <Text style={styles.overlaySubtitle}>{t('beshTash.failedSubtitle')}</Text>
            <Button label={t('beshTash.restart')} onPress={restart} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  headerSpacer: {
    width: 44,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.xl,
  },
  centerBlock: {
    alignItems: 'center',
    gap: spacing.md,
  },
  overlay: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  overlayTitle: {
    ...typography.display,
    color: colors.textPrimary,
  },
  overlaySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
