import { router } from 'expo-router';
import { Check, Share2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, IconButton, SectionHeader } from '@/components/ui';
import { regionHubRoute, regionTone } from '@/features/explore/regions/regionExperiences';
import { useRegionExperiences } from '@/features/explore/regions/useRegionExperiences';
import { buildRegionShareCard, computeRegionProgress, regionStatus, regionSummary, type RegionStatus } from '@/features/explore/regions/regionModel';
import { useRegionSignals } from '@/features/explore/regions/useRegionSignals';
import type { SupportedLanguage } from '@/i18n';
import type { AgeExperience } from '@/services/ageExperience/types';
import { useExploreRegions } from '@/services/content/exploreService';
import { mapExploreRegionName } from '@/services/content/types';
import { useShareCard } from '@/services/share/useShareCard';
import { colors, editorial, radii, spacing, textStyles, typography } from '@/theme';

const TILTS = ['-3deg', '2deg', '-2deg', '3deg', '-4deg', '2deg', '-2deg'];
const STAMP_WIDTH: Record<AgeExperience, number> = { child: 150, preteen: 108, teen: 102, adult: 96 };

/**
 * Regions page of the Passport: one stamp per Region Hub, in the same order
 * as everywhere else, with the state DERIVED from region progress (nothing
 * stored). Completed = every counted action done; opening a region never
 * completes it. Recognition only - no XP, coins or leaderboard.
 */
export function RegionsJourneySection({ experience }: { experience: AgeExperience }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const signals = useRegionSignals();
  const { data: rows } = useExploreRegions();
  const { share, shareHost } = useShareCard();
  const configs = useRegionExperiences();
  const summary = regionSummary(configs, signals);
  const isChild = experience === 'child';
  const width = STAMP_WIDTH[experience];

  const stamps = configs.flatMap((config, index) => {
    const row = rows?.find((candidate) => candidate.id === config.id);
    if (!row) return [];
    const progress = computeRegionProgress(config, signals);
    return [{ config, index, name: mapExploreRegionName(row)[language] ?? row.name_kg, progress, status: regionStatus(progress) }];
  });
  if (stamps.length === 0) return null;

  const stateLabel = (status: RegionStatus) => t(`journey.regions.state.${status}`);

  return (
    <View style={styles.section}>
      <SectionHeader title={t('journey.regions.title')} size="sm" inset={0} editorialTitle={experience === 'adult'} />
      <Text style={styles.summary} accessibilityLiveRegion="polite">
        {t('journey.regions.started', { count: summary.started, total: summary.total })} · {t('journey.regions.completedCount', { count: summary.completed, total: summary.total })}
      </Text>
      <View style={styles.grid}>
        {stamps.map(({ config, index, name, progress, status }) => {
          const progressText = t('regionHub.progress', { completed: progress.completed, total: progress.total });
          const label = `${t('journey.regions.a11yName', { name })}. ${stateLabel(status)}.${status === 'in_progress' ? ` ${progressText}.` : ''}`;
          return (
            <View key={config.id} style={[styles.stampWrap, { width }]}>
              <AnimatedPressable
                style={[styles.stamp, { transform: [{ rotate: TILTS[index % TILTS.length] }] }, status === 'completed' && styles.stampDone, status === 'not_started' && styles.stampIdle]}
                onPress={() => router.push(regionHubRoute(config.id) as never)}
                accessibilityRole="button"
                accessibilityLabel={label}
              >
                <View style={[styles.badge, { backgroundColor: status === 'completed' ? colors.accentGold : status === 'in_progress' ? regionTone(config.id) : colors.surfaceMuted }]}>
                  {status === 'completed' ? <Check size={16} color={colors.textPrimary} strokeWidth={3} /> : <OymoOrnament size={14} color={status === 'in_progress' ? colors.textOnDark : colors.textMuted} strokeWidth={1.75} />}
                </View>
                <Text style={[styles.name, experience === 'adult' && styles.nameEditorial, isChild && styles.nameChild]} numberOfLines={2}>
                  {name}
                </Text>
                <Text style={[styles.state, status === 'completed' && styles.stateDone]} numberOfLines={2}>
                  {status === 'in_progress' && !isChild ? progressText : stateLabel(status)}
                </Text>
              </AnimatedPressable>
              {status === 'completed' ? (
                <IconButton
                  icon={Share2}
                  size={32}
                  iconSize={14}
                  shape="roundedSquare"
                  elevated={false}
                  accessibilityLabel={t('journey.regions.share', { name })}
                  onPress={() =>
                    void share(
                      buildRegionShareCard({ name, label: t('regionHub.kicker'), progressLine: t('journey.regions.state.completed'), imageSource: config.heroImage, fallbackTone: regionTone(config.id) }),
                      t('regionHub.shareMessage', { name }),
                    )
                  }
                />
              ) : null}
            </View>
          );
        })}
      </View>
      {shareHost}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  summary: { ...typography.caption, fontWeight: '700', color: colors.accentTerracotta },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stampWrap: { alignItems: 'center', gap: 4 },
  stamp: { width: '100%', alignItems: 'center', gap: 4, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, borderRadius: radii.lg, borderWidth: 2, borderColor: colors.accentGold, backgroundColor: colors.surfaceElevated },
  stampDone: { backgroundColor: colors.surface, borderColor: colors.primary },
  stampIdle: { borderStyle: 'dashed', borderColor: colors.borderSubtle },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  name: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  nameEditorial: { ...editorial(textStyles.bodyMedium) },
  nameChild: { fontSize: 18 },
  state: { ...textStyles.small, color: colors.textSecondary, textAlign: 'center' },
  stateDone: { color: colors.primary, fontWeight: '700' },
});
