import { ChevronLeft, Heart, Share2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, ProgressBar } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { colors, radii, spacing, typography } from '@/theme';

import { DiscoveriesRow } from './components';
import type { ExploreDiscovery, ExploreLocation } from './types';
import type { RegionState } from '@/services/explore/regionState';

const TONES = [colors.tiles.culture, colors.tiles.food, colors.tiles.music, colors.tiles.map];

type LocationDetailScreenProps = {
  location: ExploreLocation;
  toneIndex: number;
  state: RegionState;
  discoveries: ExploreDiscovery[];
  discoveredIds: string[];
  isFavorite: boolean;
  onPressBack?: () => void;
  onPressDiscovery?: (discoveryId: string) => void;
  onToggleFavorite?: () => void;
};

export function LocationDetailScreen({
  location,
  toneIndex,
  state,
  discoveries,
  discoveredIds,
  isFavorite,
  onPressBack,
  onPressDiscovery,
  onToggleFavorite,
}: LocationDetailScreenProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const tone = TONES[toneIndex % TONES.length];
  const locationName = location.name[i18n.language as SupportedLanguage] ?? location.name.kg;

  function handleShare() {
    // Rejects on web with no Web Share API, or when the user backs out of
    // the native sheet - neither is a real error worth surfacing (same
    // convention as GamesScreen's invite-friends share).
    Share.share({ message: t('explore.locationDetail.shareMessage', { name: locationName }) }).catch(() => {});
  }

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: tone, paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.heroTopRow}>
            <IconButton
              icon={ChevronLeft}
              shape="roundedSquare"
              accessibilityLabel={t('explore.locationDetail.backLabel')}
              onPress={onPressBack}
              variant="surface"
            />
            <View style={styles.heroActions}>
              <IconButton
                icon={Heart}
                shape="roundedSquare"
                accessibilityLabel={
                  isFavorite ? t('explore.locationDetail.unfavoriteLabel') : t('explore.locationDetail.favoriteLabel')
                }
                onPress={onToggleFavorite}
                variant={isFavorite ? 'primary' : 'surface'}
              />
              <IconButton
                icon={Share2}
                shape="roundedSquare"
                accessibilityLabel={t('explore.locationDetail.shareLabel')}
                onPress={handleShare}
                variant="surface"
              />
            </View>
          </View>
          <Text style={styles.heroTitle}>{locationName}</Text>
          <Text style={styles.heroSubtitle}>{location.tagline}</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.progressBlock}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>
                {t('explore.locationDetail.progressLabel', { percent: location.discoveredPercent })}
              </Text>
              <Text style={styles.stateLabel}>{t(`explore.locationDetail.state.${state}`)}</Text>
            </View>
            <ProgressBar progress={location.discoveredPercent / 100} height={8} />
          </View>

          <View style={styles.discoveriesSection}>
            {discoveries.length > 0 ? (
              <DiscoveriesRow
                discoveries={discoveries}
                discoveredIds={discoveredIds}
                onPressDiscovery={(discovery) => onPressDiscovery?.(discovery.id)}
                title={t('explore.locationDetail.discoveriesTitle')}
              />
            ) : (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('explore.locationDetail.discoveriesTitle')}</Text>
                <Text style={styles.emptyText}>{t('explore.locationDetail.noDiscoveries')}</Text>
              </View>
            )}
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
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroActions: {
    flexDirection: 'row',
    gap: spacing.xs,
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
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  stateLabel: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '700',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  discoveriesSection: {
    marginHorizontal: -spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
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
