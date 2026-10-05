import { router, usePathname } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, spacing, textStyles } from '@/theme';

import { learnRoute } from './learningPaths';
import { PathContinueOverlay, usePathContext } from './PathContinueCard';
import { usePathSignals } from './usePathSignals';

/**
 * "Back to Learning Path" + "Continue learning" - shown only on a STEP of
 * the path the screen was opened from (`?fromPath=<id>`), for the account
 * that opened it. Direct links and unrelated screens are untouched. Not
 * shown over games: the 3D HUD owns that space, and the game result sheet
 * shows its own Continue (ResultScreen); normal back returns to the path.
 */
export function PathReturnPill() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { owner } = usePathSignals();
  const context = usePathContext(owner);
  if (!context || pathname.startsWith('/learn') || pathname.startsWith('/games')) return null;
  const { path } = context;
  return (
    <View style={[styles.dock, { bottom: insets.bottom + spacing.md }]} pointerEvents="box-none">
      <PathContinueOverlay />
      <AnimatedPressable
        style={styles.pill}
        // Back to the PATH, not the previous step (steps can be chained via Continue).
        onPress={() => router.dismissTo(learnRoute(path.id) as never)}
        accessibilityRole="button"
        accessibilityLabel={`${t('learningPaths.backToPath')}: ${t(path.titleKey)}`}
        testID="path-return"
      >
        <ChevronLeft size={14} color={colors.textOnDark} strokeWidth={2.5} />
        <Text style={styles.text} numberOfLines={1}>
          {t('learningPaths.backToPath')}
        </Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: spacing.md, right: spacing.md, gap: spacing.xs, zIndex: 50, maxWidth: 560 },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.primary, maxWidth: '70%' },
  text: { ...textStyles.small, fontWeight: '700', color: colors.textOnDark },
});
