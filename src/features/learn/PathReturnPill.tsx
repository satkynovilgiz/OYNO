import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, spacing, textStyles } from '@/theme';

import { LEARNING_PATHS, learnRoute } from './learningPaths';

/**
 * "Back to Learning Path" - shown only when a screen was opened from a
 * path (`?fromPath=<id>`). Standalone routes are untouched. Not shown over
 * games (the 3D HUD owns that space; normal back returns to the path).
 */
export function PathReturnPill() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { fromPath } = useGlobalSearchParams<{ fromPath?: string }>();
  const path = typeof fromPath === 'string' ? LEARNING_PATHS.find((candidate) => candidate.id === fromPath) : undefined;
  if (!path || pathname.startsWith('/learn') || pathname.startsWith('/games')) return null;
  return (
    <AnimatedPressable
      style={[styles.pill, { bottom: insets.bottom + spacing.md }]}
      onPress={() => (router.canGoBack() ? router.back() : router.replace(learnRoute(path.id) as never))}
      accessibilityRole="button"
      accessibilityLabel={`${t('learningPaths.backToPath')}: ${t(path.titleKey)}`}
      testID="path-return"
    >
      <ChevronLeft size={14} color={colors.textOnDark} strokeWidth={2.5} />
      <Text style={styles.text} numberOfLines={1}>
        {t('learningPaths.backToPath')}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  pill: { position: 'absolute', left: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.primary, zIndex: 50, maxWidth: '70%' },
  text: { ...textStyles.small, fontWeight: '700', color: colors.textOnDark },
});
