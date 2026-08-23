import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, ProgressBar } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { colors, radii, spacing, typography } from '@/theme';

import { CategoryGrid } from './components';
import type { ExploreLocation } from './types';

const TONES = [colors.tiles.culture, colors.tiles.food, colors.tiles.music, colors.tiles.map];

type LocationDetailScreenProps = {
  location: ExploreLocation;
  toneIndex: number;
  onPressBack?: () => void;
};

export function LocationDetailScreen({ location, toneIndex, onPressBack }: LocationDetailScreenProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const tone = TONES[toneIndex % TONES.length];
  const locationName = location.name[i18n.language as SupportedLanguage] ?? location.name.kg;

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: tone, paddingTop: insets.top + spacing.sm }]}>
          <IconButton
            icon={ChevronLeft}
            shape="roundedSquare"
            accessibilityLabel={t('explore.locationDetail.backLabel')}
            onPress={onPressBack}
            variant="surface"
          />
          <Text style={styles.heroTitle}>{locationName}</Text>
          <Text style={styles.heroSubtitle}>{location.tagline}</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.progressBlock}>
            <Text style={styles.progressLabel}>
              {t('explore.locationDetail.progressLabel', { percent: location.discoveredPercent })}
            </Text>
            <ProgressBar progress={location.discoveredPercent / 100} height={8} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('explore.locationDetail.sectionsTitle')}</Text>
            <CategoryGrid />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('explore.locationDetail.factsTitle')}</Text>
            {location.facts.map((fact, index) => (
              <View key={index} style={styles.factRow}>
                <View style={styles.factDot} />
                <Text style={styles.factText}>{fact}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  hero: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.xxs,
    borderBottomLeftRadius: radii.xxl,
    borderBottomRightRadius: radii.xxl,
  },
  heroTitle: {
    ...typography.display,
    color: colors.textOnDark,
    marginTop: spacing.md,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.textOnDark,
    opacity: 0.9,
  },
  body: {
    padding: spacing.md,
    gap: spacing.xl,
  },
  progressBlock: {
    gap: spacing.xxs,
  },
  progressLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  factRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
  factDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 8,
  },
  factText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 21,
  },
});
