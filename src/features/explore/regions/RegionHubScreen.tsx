import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowRight, Check, ChevronLeft, Map as MapIcon, Share2 } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StoryCompanion } from '@/components/companion/CompanionMoment';
import { NotFoundState } from '@/components/system/NotFoundState';
import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, Button, CompactContentCard, IconButton, ProgressBar, Rail, SectionHeader, Skeleton } from '@/components/ui';
import { cultureItemImages, cultureMaterialImages } from '@/features/culture/data';
import { DestinationRail } from '@/features/explore/components/DestinationCards';
import { DiscoveriesRow } from '@/features/explore/components/DiscoveriesRow';
import { discoveryImages, LOCATION_TONES, natureSiteImages } from '@/features/explore/data';
import type { ExploreDiscovery } from '@/features/explore/types';
import { QuestCard } from '@/features/quests/QuestCard';
import { getGuidedQuest } from '@/features/quests/questsData';
import { useQuestProgress } from '@/features/quests/useQuests';
import { computeTrailProgress } from '@/features/trails/trailProgress';
import { getTrail } from '@/features/trails/trailsData';
import { TrailsRow } from '@/features/trails/TrailsRow';
import { useTrailSignals } from '@/features/trails/useTrailSignals';
import type { SupportedLanguage } from '@/i18n';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useCultureItem } from '@/services/content/cultureItemsService';
import { useCultureMaterial } from '@/services/content/cultureService';
import { useDiscoveries } from '@/services/content/discoveriesService';
import { useExploreRegions } from '@/services/content/exploreService';
import { regionTagline } from '@/services/content/regionTaglines';
import { mapDiscoveryTitle, mapExploreRegionName } from '@/services/content/types';
import { useShareCard } from '@/services/share/useShareCard';
import { useProgressStore } from '@/store/useProgressStore';
import { cardRadii, colors, editorial, spacing, textStyles } from '@/theme';

import { getRegionExperience, type RegionExperienceConfig } from './regionExperiences';
import { buildRegionShareCard, computeRegionProgress, pickStartHere, type RegionSignals } from './regionModel';

/**
 * Region Hub (/explore/region/[id]) - one reusable screen for every region
 * config in regionExperiences.ts. Everything shown is existing content
 * resolved by id; progress comes from the existing progress store (visits,
 * discoveries, trail stops, guided quest steps). Sections with no linked
 * content don't render.
 */
export function RegionHubScreen({ regionId, onPressBack }: { regionId: string; onPressBack: () => void }) {
  const config = getRegionExperience(regionId);
  if (!config) return <NotFoundState onPressBack={onPressBack} />;
  return <RegionHub config={config} onPressBack={onPressBack} />;
}

function RegionHub({ config, onPressBack }: { config: RegionExperienceConfig; onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';
  const { share, shareHost } = useShareCard();

  const { data: regions, isLoading: regionsLoading } = useExploreRegions();
  const { data: discoveryRows } = useDiscoveries();
  const visitedRegionIds = useProgressStore((state) => state.visitedRegionIds);
  const discoveredIds = useProgressStore((state) => state.discoveredExploreIds);
  const trailSignals = useTrailSignals();
  const questProgress = useQuestProgress();

  const regionRow = regions?.find((row) => row.id === config.id) ?? null;
  const name = regionRow ? (mapExploreRegionName(regionRow)[language] ?? regionRow.name_kg) : '';

  const signals: RegionSignals = useMemo(() => {
    const trails: RegionSignals['trails'] = {};
    for (const id of config.trailIds) {
      const trail = getTrail(id);
      if (trail) trails[id] = computeTrailProgress(trail, trailSignals);
    }
    const quests: RegionSignals['quests'] = {};
    for (const id of config.questIds) {
      const entry = questProgress.find((progress) => progress.quest.id === id);
      if (entry) quests[id] = { completed: entry.completed, total: entry.total };
    }
    return { visitedRegionIds, discoveredIds, trails, quests };
  }, [config, visitedRegionIds, discoveredIds, trailSignals, questProgress]);

  const progress = computeRegionProgress(config, signals);
  const next = pickStartHere(config, signals);

  const places = config.destinationIds.flatMap((id, index) => {
    const row = regions?.find((candidate) => candidate.id === id);
    if (!row) return [];
    return [
      {
        id,
        name: mapExploreRegionName(row)[language] ?? row.name_kg,
        tagline: regionTagline(row, language),
        imageSource: natureSiteImages[id] ?? (id === config.id ? config.heroImage : null),
        toneIndex: index,
        visited: visitedRegionIds.includes(id),
      },
    ];
  });

  const discoveries: ExploreDiscovery[] = config.discoveryIds.flatMap((id) => {
    const row = discoveryRows?.find((candidate) => candidate.id === id);
    return row ? [{ id, title: mapDiscoveryTitle(row)[language] ?? row.title_kg, category: row.category, xpReward: row.xp_reward, imageSource: discoveryImages[id] }] : [];
  });

  const progressText = t('regionHub.progress', { completed: progress.completed, total: progress.total });
  const tone = LOCATION_TONES[0];

  function openStart() {
    if (next.kind === 'destination') router.push(`/explore/${next.id}` as never);
    else if (next.kind === 'discovery') router.push(`/explore/${next.destinationId}` as never);
    else if (next.kind === 'trail') router.push(`/trails/${next.id}` as never);
    else if (next.kind === 'quest') router.push(`/quests/${next.id}` as never);
  }

  function startLabel(): string {
    if (next.kind === 'destination') return t('regionHub.start.destination', { name: places.find((place) => place.id === next.id)?.name ?? name });
    if (next.kind === 'discovery') return t('regionHub.start.discovery', { name: discoveries.find((discovery) => discovery.id === next.id)?.title ?? '' });
    if (next.kind === 'trail') {
      const trail = getTrail(next.id);
      return t('regionHub.start.trail', { name: trail ? (trail.title[language] ?? trail.title.kg) : '' });
    }
    if (next.kind === 'quest') {
      const quest = getGuidedQuest(next.id);
      return t('regionHub.start.quest', { name: quest ? (quest.title[language] ?? quest.title.kg) : '' });
    }
    return t('regionHub.start.done');
  }

  function handleShare() {
    void share(
      buildRegionShareCard({ name, label: t('regionHub.kicker'), progressLine: progressText, imageSource: config.heroImage, fallbackTone: tone }),
      t('regionHub.shareMessage', { name }),
    );
  }

  const loading = regionsLoading && !regionRow;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }} showsVerticalScrollIndicator={false}>
        {/* Hero: the region's photo (or its tone), name, intro, real progress. */}
        <View style={[styles.hero, isChild && styles.heroChild, { backgroundColor: tone }]}>
          {config.heroImage ? <Image source={config.heroImage} style={styles.heroImage} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
          <LinearGradient colors={['rgba(19,32,24,0.5)', 'rgba(19,32,24,0.05)', 'rgba(19,32,24,0.9)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroTop, { paddingTop: insets.top + spacing.xs }]}>
            <IconButton icon={ChevronLeft} size={40} iconSize={20} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
            {name ? <IconButton icon={Share2} size={40} iconSize={19} shape="roundedSquare" accessibilityLabel={t('regionHub.shareLabel', { name })} onPress={handleShare} /> : null}
          </View>
          <View style={styles.heroBottom}>
            <View style={styles.kickerRow}>
              <OymoOrnament size={10} color={colors.accentGold} strokeWidth={1.75} />
              <Text style={styles.kicker}>{t('regionHub.kicker')}</Text>
            </View>
            {loading ? <Skeleton width="60%" height={34} /> : (
              <Text style={[styles.title, isAdult && styles.titleEditorial]} accessibilityRole="header">
                {name}
              </Text>
            )}
            <Text style={styles.intro} numberOfLines={isChild ? 2 : 3}>
              {t(`regionHub.regions.${config.id}.intro`)}
            </Text>
            <View style={styles.progress} accessible accessibilityRole="progressbar" accessibilityLabel={t('regionHub.progressLabel')} accessibilityValue={{ min: 0, max: progress.total, now: progress.completed, text: progressText }}>
              <Text style={styles.progressText}>{progressText}</Text>
              <ProgressBar progress={progress.total > 0 ? progress.completed / progress.total : 0} height={4} fillColor={colors.accentGold} trackColor="rgba(251,243,227,0.24)" />
            </View>
          </View>
        </View>

        {/* Start here - the next real unfinished activity (fixed order). */}
        <View style={styles.pad}>
          <StoryCompanion surface="region" moment="intro" />
          <AnimatedPressable
            style={[styles.start, next.kind === 'done' && styles.startDone]}
            onPress={openStart}
            disabled={next.kind === 'done'}
            hoverEffect
            accessibilityRole={next.kind === 'done' ? 'text' : 'button'}
            accessibilityLabel={`${t('regionHub.startHere')}: ${startLabel()}`}
          >
            <View style={styles.startIcon}>{next.kind === 'done' ? <Check size={18} color={colors.textPrimary} strokeWidth={3} /> : <OymoOrnament size={16} color={colors.textPrimary} strokeWidth={1.75} />}</View>
            <View style={styles.startText}>
              <Text style={styles.startEyebrow}>{next.kind === 'done' ? t('regionHub.start.doneTitle') : t('regionHub.startHere')}</Text>
              <Text style={[styles.startTitle, isChild && styles.startTitleChild]} numberOfLines={2}>
                {startLabel()}
              </Text>
            </View>
            {next.kind === 'done' ? null : <ArrowRight size={20} color={colors.primary} strokeWidth={2.25} />}
          </AnimatedPressable>
        </View>

        {loading ? (
          <View style={styles.pad}>
            <Skeleton height={180} borderRadius={cardRadii.hero} />
          </View>
        ) : (
          <DestinationRail title={t('regionHub.sections.places')} sites={places} experience={experience} onPressSite={(id) => router.push(`/explore/${id}` as never)} />
        )}

        {discoveries.length > 0 ? (
          <DiscoveriesRow title={t('regionHub.sections.discoveries')} discoveries={discoveries} discoveredIds={discoveredIds} onPressDiscovery={(discovery) => useProgressStore.getState().discoverExploreItem(discovery.id)} />
        ) : null}

        {config.cultureItemIds.length + config.materialIds.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title={t('regionHub.sections.culture')} editorialTitle={isAdult} />
            <Rail itemWidth={isChild ? 176 : 152}>
              {config.cultureItemIds.map((id) => (
                <LinkedCultureItem key={`item:${id}`} id={id} width={isChild ? 176 : 152} />
              ))}
              {config.materialIds.map((id) => (
                <LinkedMaterial key={`material:${id}`} id={id} width={isChild ? 176 : 152} />
              ))}
            </Rail>
          </View>
        ) : null}

        {config.trailIds.length > 0 ? <TrailsRow experience={experience} trailIds={config.trailIds} /> : null}

        {config.questIds.length > 0 ? (
          <View style={[styles.pad, styles.section]}>
            <SectionHeader title={t('regionHub.sections.quests')} inset={0} editorialTitle={isAdult} />
            {questProgress
              .filter((entry) => config.questIds.includes(entry.quest.id))
              .map((entry) => (
                <QuestCard key={entry.quest.id} progress={entry} onPress={() => router.push(`/quests/${entry.quest.id}` as never)} />
              ))}
          </View>
        ) : null}

        <View style={styles.pad}>
          <Button label={t('regionHub.showOnMap')} variant="secondary" icon={<MapIcon size={16} color={colors.primary} strokeWidth={2.25} />} onPress={() => router.push(`/explore/map?region=${config.id}` as never)} />
        </View>
      </ScrollView>
      {shareHost}
    </View>
  );
}

/** A linked culture item, loaded by id only (never the whole catalog). */
function LinkedCultureItem({ id, width }: { id: string; width: number }) {
  const { data: item, isLoading } = useCultureItem(id);
  const image = cultureItemImages[id]?.[0];
  if (isLoading) return <Skeleton width={width} height={width * 0.75} borderRadius={cardRadii.chip} />;
  if (!item || !image) return null;
  return <CompactContentCard width={width} imageSource={image} title={item.title} onPress={() => router.push(`/culture/item/${id}` as never)} />;
}

function LinkedMaterial({ id, width }: { id: string; width: number }) {
  const { data: material, isLoading } = useCultureMaterial(id);
  const image = cultureMaterialImages[id];
  if (isLoading) return <Skeleton width={width} height={width * 0.75} borderRadius={cardRadii.chip} />;
  if (!material || !image) return null;
  return <CompactContentCard width={width} imageSource={image} title={material.title} onPress={() => router.push(`/culture/material/${id}` as never)} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: { minHeight: 380, justifyContent: 'space-between', overflow: 'hidden', borderBottomLeftRadius: cardRadii.hero, borderBottomRightRadius: cardRadii.hero },
  heroChild: { minHeight: 420 },
  // Explicit size: without it, web falls back to the file's own pixel size.
  heroImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md },
  heroBottom: { padding: spacing.md, gap: spacing.xs },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { ...textStyles.overline, color: colors.accentGold },
  title: { ...textStyles.display, color: colors.textOnDark },
  titleEditorial: { ...editorial(textStyles.display) },
  intro: { ...textStyles.body, color: 'rgba(251,243,227,0.88)' },
  progress: { gap: 6, marginTop: spacing.xs, maxWidth: 260 },
  progressText: { ...textStyles.caption, fontWeight: '700', color: colors.textOnDark },
  pad: { paddingHorizontal: spacing.md, gap: spacing.sm },
  section: { gap: spacing.sm },
  start: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 2, borderColor: colors.accentGold },
  startDone: { borderColor: colors.borderSubtle, borderWidth: 1 },
  startIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentGold },
  startText: { flex: 1, gap: 2 },
  startEyebrow: { ...textStyles.overline, color: colors.accentTerracotta },
  startTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  startTitleChild: { fontSize: 18, lineHeight: 24 },
});
