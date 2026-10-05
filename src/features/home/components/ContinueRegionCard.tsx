import { router } from 'expo-router';
import { ArrowRight, Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable } from '@/components/ui';
import { regionHubRoute, regionTone } from '@/features/explore/regions/regionExperiences';
import { useRegionExperiences } from '@/features/explore/regions/useRegionExperiences';
import { startHereLabel, startHereName } from '@/features/explore/regions/startHereLabel';
import { useRegionSignals } from '@/features/explore/regions/useRegionSignals';
import type { SupportedLanguage } from '@/i18n';
import type { AgeExperience } from '@/services/ageExperience/types';
import { track } from '@/services/analytics/analytics';
import { useDiscoveries } from '@/services/content/discoveriesService';
import { useExploreRegions } from '@/services/content/exploreService';
import { mapExploreRegionName } from '@/services/content/types';
import { useProgressStore } from '@/store/useProgressStore';
import { cardRadii, colors, editorial, spacing, textStyles } from '@/theme';

import { pickContinueRegion } from '../continueRegion';

/** Home's one "Continue exploring" card - the region picked by
 * pickContinueRegion, its real progress and the hub's own next activity.
 * Recomputed from the live progress store, so an account change updates it
 * at once (no previous user's region). */
export function ContinueRegionCard({ experience }: { experience: AgeExperience }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const signals = useRegionSignals();
  const visitDates = useProgressStore((state) => state.regionVisitDates);
  const { data: regions } = useExploreRegions();
  const { data: discoveries } = useDiscoveries();
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';

  const configs = useRegionExperiences();
  const pick = pickContinueRegion(configs, signals, visitDates);

  if (pick.kind === 'allDone') {
    return (
      <AnimatedPressable style={[styles.card, styles.done]} onPress={() => router.push('/journey' as never)} hoverEffect accessibilityRole="button" accessibilityLabel={`${t('home.continueRegion.allDone')}. ${t('home.continueRegion.viewPassport')}`}>
        <View style={styles.doneIcon}>
          <Check size={20} color={colors.textPrimary} strokeWidth={3} />
        </View>
        <Text style={[styles.title, styles.doneTitle]}>{t('home.continueRegion.allDone')}</Text>
        <Text style={styles.cta}>{t('home.continueRegion.viewPassport')}</Text>
      </AnimatedPressable>
    );
  }

  const row = regions?.find((candidate) => candidate.id === pick.config.id);
  if (!row) return null;
  const name = mapExploreRegionName(row)[language] ?? row.name_kg;
  const heading = pick.kind === 'start' ? t('home.continueRegion.start') : t('home.continueRegion.continue');
  const progressText = t('regionHub.progress', { completed: pick.progress.completed, total: pick.progress.total });
  const nextName = startHereName(pick.next, { regions, discoveries, language });
  const nextLine = pick.next.kind === 'done' ? '' : isChild ? startHereLabel(pick.next, nextName, t) : `${t('home.continueRegion.next')}: ${nextName}`;

  const target = pick;
  function open() {
    // Only the region id and the kind of next activity - no user content.
    track('home_continue_region_opened', { region_id: target.config.id, next_activity_type: target.next.kind });
    router.push(regionHubRoute(target.config.id) as never);
  }

  return (
    <AnimatedPressable style={styles.card} onPress={open} hoverEffect accessibilityRole="button" accessibilityLabel={`${heading} ${name}. ${progressText}.${nextLine ? ` ${nextLine}.` : ''}`}>
      <View style={[styles.art, isChild && styles.artChild, { backgroundColor: regionTone(pick.config.id) }]}>
        {pick.config.heroImage ? <Image source={pick.config.heroImage} style={styles.image} resizeMode="cover" /> : <OymoOrnament size={isChild ? 40 : 32} color="rgba(251,243,227,0.35)" strokeWidth={1.2} />}
      </View>
      <View style={styles.text}>
        <Text style={styles.heading}>{heading}</Text>
        <Text style={[styles.title, isAdult && styles.titleEditorial, isChild && styles.titleChild]} numberOfLines={1}>
          {name}
        </Text>
        {!isChild || pick.kind !== 'start' ? <Text style={styles.meta}>{progressText}</Text> : null}
        {nextLine ? (
          <Text style={styles.next} numberOfLines={isChild ? 2 : 1}>
            {nextLine}
          </Text>
        ) : null}
      </View>
      <View style={[styles.ctaWrap, isChild && styles.ctaWrapChild]}>
        {isChild ? <ArrowRight size={22} color={colors.textPrimary} strokeWidth={2.5} /> : <Text style={styles.cta}>{t('home.continueRegion.cta')}</Text>}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  art: { width: 72, height: 72, borderRadius: cardRadii.chip, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  artChild: { width: 84, height: 84 },
  image: { width: '100%', height: '100%' },
  text: { flex: 1, gap: 1 },
  heading: { ...textStyles.overline, color: colors.accentTerracottaText },
  title: { ...textStyles.bodyMedium, fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  titleEditorial: { ...editorial(textStyles.bodyMedium), fontSize: 19 },
  titleChild: { fontSize: 20 },
  meta: { ...textStyles.caption, color: colors.textSecondary },
  next: { ...textStyles.caption, fontWeight: '700', color: colors.primary },
  ctaWrap: { paddingHorizontal: spacing.xs },
  ctaWrapChild: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentGold },
  cta: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.primary },
  done: { justifyContent: 'space-between' },
  doneIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentGold },
  doneTitle: { flex: 1 },
});
