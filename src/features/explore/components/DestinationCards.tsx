import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { MediaCard, PhotoBadge, Rail, SectionHeader, useRailItemWidth } from '@/components/ui';
import type { AgeExperience } from '@/services/ageExperience/types';
import { useDownloadState } from '@/services/offline/useOfflineStore';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

import { LOCATION_TONES } from '../data';

export type DestinationCardData = {
  id: string;
  name: string;
  tagline: string;
  imageSource: ImageSourcePropType | null;
  toneIndex: number;
  visited: boolean;
};

/** Visited (Passport) and Offline (download) marks - separate states,
 * never merged into one badge. */
function DestinationBadges({ id, visited }: { id: string; visited: boolean }) {
  const { t } = useTranslation();
  const downloaded = useDownloadState('nature', id) === 'downloaded';
  if (!visited && !downloaded) return null;
  return (
    <View style={styles.badges}>
      {visited ? <PhotoBadge kind="visited" label={t('explore.v2.visited')} /> : null}
      {downloaded ? <PhotoBadge kind="offline" label={t('offline.available')} /> : null}
    </View>
  );
}

/** Photo-less destination: the place's own tone + oymo mark (never a
 * stretched placeholder or an invented photo). */
function ToneArt({ toneIndex }: { toneIndex: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.tone, { backgroundColor: LOCATION_TONES[toneIndex % LOCATION_TONES.length] }]}>
      <OymoOrnament size={72} color="rgba(251,243,227,0.28)" strokeWidth={1.2} />
    </View>
  );
}

/** The day's featured destination - deterministic rotation over the real
 * nature destinations (see pickFeaturedDestination). */
export function FeaturedDestinationCard({ site, experience, onPress }: { site: DestinationCardData; experience: AgeExperience; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.pad}>
      <MediaCard
        variant="hero"
        aspectRatio={experience === 'child' ? 1.2 : 1.35}
        source={site.imageSource}
        artwork={site.imageSource ? undefined : <ToneArt toneIndex={site.toneIndex} />}
        eyebrow={t('explore.v2.featured')}
        eyebrowIcon={<OymoOrnament size={10} color={colors.accentGold} strokeWidth={1.75} />}
        status={<DestinationBadges id={site.id} visited={site.visited} />}
        title={site.name}
        editorialTitle={experience === 'adult'}
        subtitle={site.tagline}
        subtitleLines={experience === 'child' ? 1 : 2}
        chevron
        onPress={onPress}
        accessibilityLabel={`${t('explore.v2.featured')}: ${site.name}. ${site.tagline}${site.visited ? `. ${t('explore.v2.visited')}` : ''}`}
      />
    </View>
  );
}

const SHARE: Record<AgeExperience, number> = { child: 0.78, preteen: 0.72, teen: 0.7, adult: 0.7 };

/** Nature destinations as ~70% cinematic cards on the shared Rail. */
export function DestinationRail({ title, sites, experience, onPressSite }: { title: string; sites: DestinationCardData[]; experience: AgeExperience; onPressSite: (id: string) => void }) {
  const { t } = useTranslation();
  const width = useRailItemWidth('medium', SHARE[experience]);
  if (sites.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionHeader title={title} count={sites.length} editorialTitle={experience === 'adult'} />
      <Rail itemWidth={width} snap>
        {sites.map((site) => (
          <MediaCard
            key={site.id}
            variant="portrait"
            width={width}
            aspectRatio={experience === 'child' ? 0.95 : 1.05}
            source={site.imageSource}
            artwork={site.imageSource ? undefined : <ToneArt toneIndex={site.toneIndex} />}
            status={<DestinationBadges id={site.id} visited={site.visited} />}
            title={site.name}
            editorialTitle={experience === 'adult'}
            subtitle={experience === 'child' ? undefined : site.tagline}
            subtitleLines={2}
            chevron
            onPress={() => onPressSite(site.id)}
            accessibilityLabel={`${site.name}. ${site.tagline}${site.visited ? `. ${t('explore.v2.visited')}` : ''}`}
          />
        ))}
      </Rail>
    </View>
  );
}

/** Real visit history as small, personal cards: photo, name, visit date. */
export function RecentPlacesRow({ places, onPressPlace }: { places: (DestinationCardData & { visitedAt: string })[]; onPressPlace: (id: string) => void }) {
  const { t } = useTranslation();
  const width = useRailItemWidth('compact', 0.36);
  if (places.length === 0) return null;
  return (
    <View style={styles.sectionTight}>
      <SectionHeader title={t('home.journey.recentlyExplored')} size="sm" />
      <Rail itemWidth={width} gap={spacing.xs}>
        {places.map((place) => (
          <MediaCard
            key={place.id}
            variant="compact"
            width={width}
            aspectRatio={0.9}
            source={place.imageSource}
            artwork={place.imageSource ? undefined : <ToneArt toneIndex={place.toneIndex} />}
            title={place.name}
            footer={<Text style={styles.date}>{formatVisitDate(place.visitedAt)}</Text>}
            onPress={() => onPressPlace(place.id)}
            accessibilityLabel={`${place.name}, ${formatVisitDate(place.visitedAt)}`}
            style={styles.recentCard}
          />
        ))}
      </Rail>
    </View>
  );
}

/** "24.09" - numeric, so it reads the same in KG/RU/EN. */
export function formatVisitDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.md },
  section: { gap: spacing.sm },
  sectionTight: { gap: spacing.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4, flexShrink: 1 },
  tone: { alignItems: 'center', justifyContent: 'center' },
  date: { ...textStyles.small, color: colors.textOnDarkSecondary },
  recentCard: { borderRadius: cardRadii.compact },
});
