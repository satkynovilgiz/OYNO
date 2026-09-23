import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, IconButton } from '@/components/ui';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

import { wallpapers } from './wallpapers';

/**
 * Appearance - exactly two things: Wallpapers and OYNO Widgets (no app
 * icons). Two large editorial entry cards: a fan of real wallpaper
 * previews, and a deep-green widgets card.
 */
export function AppearanceScreen({ onPressBack }: { onPressBack: () => void }) {
  useTrackScreenView('appearance');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const featured = wallpapers.filter((wallpaper) => wallpaper.featured).slice(0, 3);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('appearance.title')}</Text>
          <Text style={styles.subtitle}>{t('appearance.subtitle')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        <AnimatedPressable
          style={styles.wallpaperCard}
          onPress={() => router.push('/appearance/wallpapers' as never)}
          pressScale={0.98}
          hoverEffect
          accessibilityRole="button"
          accessibilityLabel={`${t('appearance.wallpapers.title')}. ${t('appearance.wallpapers.entryDescription')}`}
        >
          <View style={styles.fan} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {featured.map((wallpaper, index) => (
              <Image
                key={wallpaper.id}
                source={wallpaper.image}
                resizeMode="cover"
                style={[styles.fanPhone, { transform: [{ rotate: `${(index - 1) * 7}deg` }, { translateY: index === 1 ? -6 : 4 }], zIndex: index === 1 ? 2 : 1 }]}
              />
            ))}
          </View>
          <View style={styles.cardFooter}>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{t('appearance.wallpapers.title')}</Text>
              <Text style={styles.cardBody}>{t('appearance.wallpapers.entryDescription')}</Text>
            </View>
            <ChevronRight size={20} color={colors.primary} strokeWidth={2.25} />
          </View>
        </AnimatedPressable>

        <AnimatedPressable
          style={styles.widgetCard}
          onPress={() => router.push('/appearance/widgets' as never)}
          pressScale={0.98}
          hoverEffect
          accessibilityRole="button"
          accessibilityLabel={`${t('appearance.widgets.title')}. ${t('appearance.widgets.entryDescription')}`}
        >
          <View style={styles.widgetMocks} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={styles.mockSmall}>
              <OymoOrnament size={14} color={colors.accentGold} strokeWidth={1.5} />
              <View style={styles.mockLineWide} />
              <View style={styles.mockLine} />
            </View>
            <View style={styles.mockMedium}>
              <View style={styles.mockCircle} />
              <View style={styles.mockLines}>
                <View style={styles.mockLineWide} />
                <View style={styles.mockLine} />
              </View>
            </View>
          </View>
          <View style={styles.cardFooter}>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, styles.onDark]}>{t('appearance.widgets.title')}</Text>
              <Text style={[styles.cardBody, styles.onDarkMuted]}>{t('appearance.widgets.entryDescription')}</Text>
            </View>
            <ChevronRight size={20} color={colors.accentGold} strokeWidth={2.25} />
          </View>
        </AnimatedPressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  headerText: { flex: 1 },
  title: { ...typography.h1, fontFamily: fontFamily.wordmark, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  content: { paddingHorizontal: spacing.md, gap: spacing.lg },
  wallpaperCard: { borderRadius: radii.xxl, backgroundColor: colors.surface, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(199,154,46,0.35)' },
  fan: { height: 230, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceWarm, paddingTop: spacing.md },
  fanPhone: { width: 92, height: 190, borderRadius: 18, marginHorizontal: -10, borderWidth: 3, borderColor: colors.surface },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { ...typography.h1, fontFamily: fontFamily.wordmark, color: colors.textPrimary },
  cardBody: { ...typography.caption, color: colors.textSecondary },
  onDark: { color: colors.textOnDark },
  onDarkMuted: { color: 'rgba(255,255,255,0.72)' },
  widgetCard: { borderRadius: radii.xxl, backgroundColor: colors.surfaceFeature, overflow: 'hidden' },
  widgetMocks: { height: 190, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  mockSmall: { width: 110, height: 110, borderRadius: 26, backgroundColor: colors.primary, padding: spacing.sm, justifyContent: 'space-between' },
  mockMedium: { width: 150, height: 110, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.08)', padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mockCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 4, borderColor: colors.accentGold },
  mockLines: { flex: 1, gap: 6 },
  mockLineWide: { height: 8, borderRadius: 4, backgroundColor: 'rgba(251,243,227,0.85)', width: '90%' },
  mockLine: { height: 6, borderRadius: 3, backgroundColor: 'rgba(251,243,227,0.45)', width: '60%' },
});
