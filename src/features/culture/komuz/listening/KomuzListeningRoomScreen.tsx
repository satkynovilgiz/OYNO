import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Heart, Pause, Play, SkipBack, SkipForward } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, Button, IconButton, ProgressBar } from '@/components/ui';
import { komuzTracks, type KomuzTrack } from '@/features/culture/audioData';
import { cultureCategoryImages } from '@/features/culture/data';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { track } from '@/services/analytics/analytics';
import { ownerLibrary, useKomuzLibraryStore } from '@/store/useKomuzLibraryStore';
import { useListeningStore } from '@/store/useListeningStore';
import { colors, editorial, radii, spacing, textStyles, typography } from '@/theme';

import { clockTime, filterTracks, nextIndex, previousIndex, realDuration, showFavoritesFilter, spokenTime, type TrackFilter } from './komuzQueue';
import { RHYTHM_CHARTS } from '../rhythm/rhythmCharts';
import { supportedCharts } from '../rhythm/rhythmModel';
import { registerKomuzHost, useKomuzPlayerStore } from './useKomuzPlayerStore';
import { shareContentLink } from '@/services/links/shareContentLink';

/**
 * /culture/komuz/listen - the Komuz Listening Room: the existing bundled
 * komuzTracks only (titles and performers exactly as authored; unconfirmed
 * names stay labelled), one shared player, a real scrubber only when the
 * player reports a real duration. Calm: no play counts, no ranks.
 */
export function KomuzListeningRoomScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';
  const owner = useRecordsOwner();
  const library = ownerLibrary(useKomuzLibraryStore((state) => state.saved), owner);
  const [filter, setFilter] = useState<TrackFilter>('all');
  const [savedPoint, setSavedPoint] = useState<string | null>(null);
  const params = useLocalSearchParams<{ resumeTrack?: string; at?: string; track?: string }>();
  // A shared track link (?track=) selects the track - it never autoplays.
  const sharedTrack = komuzTracks.find((entry) => entry.id === params.track) ?? null;
  const resumeTrack = komuzTracks.find((entry) => entry.id === params.resumeTrack) ?? sharedTrack;
  const resumeAt = Number.isFinite(Number(params.at)) && Number(params.at) > 0 ? Math.min(3600, Math.floor(Number(params.at))) : 0;

  const currentTrackId = useKomuzPlayerStore((state) => state.currentTrackId);
  const playing = useKomuzPlayerStore((state) => state.playing);
  const position = useKomuzPlayerStore((state) => state.position);
  const duration = realDuration(useKomuzPlayerStore((state) => state.duration));
  const queue = useKomuzPlayerStore((state) => state.queue);
  const queueIndex = useKomuzPlayerStore((state) => state.queueIndex);

  useEffect(() => {
    void useKomuzLibraryStore.getState().load();
    track('komuz_listening_room_opened');
    return registerKomuzHost();
  }, []);

  // Recently listened: only after meaningful playback, for the CURRENT owner.
  useEffect(() => {
    useKomuzPlayerStore.getState().setOnListened((trackId) => useKomuzLibraryStore.getState().markListened(owner, trackId));
    return () => useKomuzPlayerStore.getState().setOnListened(null);
  }, [owner]);

  const trackIds = komuzTracks.map((entry) => entry.id);
  const rhythmAvailable = supportedCharts(RHYTHM_CHARTS, trackIds).length > 0;
  const favoritesAvailable = showFavoritesFilter(library.favorites, trackIds);
  const activeFilter: TrackFilter = favoritesAvailable ? filter : 'all';
  const visible = filterTracks(komuzTracks, activeFilter, library.favorites);
  const current = komuzTracks.find((entry) => entry.id === currentTrackId) ?? null;
  const shown = current ?? resumeTrack ?? visible[0] ?? komuzTracks[0];
  const recent = library.recent.map((id) => komuzTracks.find((entry) => entry.id === id)).filter((entry): entry is KomuzTrack => !!entry);

  const playFrom = (id: string) => {
    const store = useKomuzPlayerStore.getState();
    if (id === currentTrackId) store.toggle();
    else store.play(id, visible.some((entry) => entry.id === id) ? visible.map((entry) => entry.id) : trackIds);
  };
  const isPlayingTrack = (id: string) => id === currentTrackId && playing;
  const hasPrevious = !!current && previousIndex(queueIndex) !== null;
  const hasNext = !!current && nextIndex(queue.length, queueIndex) !== null;
  const timeLabel = duration !== null ? t('komuzRoom.timeOf', { elapsed: spokenTime(position, t), duration: spokenTime(duration, t) }) : null;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={[styles.title, isAdult && styles.titleEditorial]} accessibilityRole="header" numberOfLines={1}>
          {t('komuzRoom.title')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        {/* Opened from listening history / a bookmark: resume ONLY on tap. */}
        {resumeTrack && !current ? (
          <AnimatedPressable
            style={styles.resume}
            onPress={() => (resumeAt > 0 ? useKomuzPlayerStore.getState().playFrom(resumeTrack.id, resumeAt) : useKomuzPlayerStore.getState().play(resumeTrack.id))}
            accessibilityRole="button"
            accessibilityLabel={`${resumeTrack === sharedTrack && !params.resumeTrack ? t('contentLinks.playTrack') : t('listening.resume')}: ${resumeTrack.title}${resumeAt > 0 ? `. ${t('listening.at', { minutes: Math.floor(resumeAt / 60), seconds: resumeAt % 60 })}` : ''}`}
          >
            <Play size={16} color={colors.primary} strokeWidth={2.5} />
            <Text style={styles.resumeText} numberOfLines={1}>
              {resumeTrack === sharedTrack && !params.resumeTrack ? t('contentLinks.playTrack') : t('listening.resume')} · {resumeTrack.title}
              {resumeAt > 0 ? ` · ${clockTime(resumeAt)}` : ''}
            </Text>
          </AnimatedPressable>
        ) : null}

        {/* Now playing - existing komuz art, never an invented cover. */}
        <View style={styles.nowPlaying}>
          <View style={[styles.art, isChild && styles.artChild]}>
            {cultureCategoryImages.komuz ? (
              <Image source={cultureCategoryImages.komuz} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
            ) : (
              <OymoOrnament size={64} color="rgba(232,185,61,0.5)" strokeWidth={1.25} />
            )}
          </View>
          <Text style={styles.kicker}>{current ? t('komuzRoom.nowPlaying') : t('komuzRoom.allTracks')}</Text>
          <Text style={[styles.trackTitle, isAdult && styles.titleEditorial]} numberOfLines={2}>
            {shown.title}
          </Text>
          {shown.performer ? <Text style={styles.performer}>{shown.performer}</Text> : null}
          {!shown.titleConfirmed ? <Text style={styles.unconfirmed}>{t('komuzRoom.titleUnconfirmed')}</Text> : null}

          {current && duration !== null ? (
            <Scrubber position={position} duration={duration} label={timeLabel!} onSeek={(seconds) => useKomuzPlayerStore.getState().seek(seconds)} />
          ) : null}
          {current && duration !== null ? (
            <View style={styles.times} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text style={styles.time}>{clockTime(position)}</Text>
              <Text style={styles.time}>{clockTime(duration)}</Text>
            </View>
          ) : null}

          <View style={styles.controls}>
            <IconButton icon={SkipBack} size={isChild ? 56 : 48} iconSize={isChild ? 24 : 20} disabled={!hasPrevious} accessibilityLabel={t('komuzRoom.previous')} onPress={() => useKomuzPlayerStore.getState().previous()} />
            <AnimatedPressable
              style={[styles.playButton, isChild && styles.playButtonChild]}
              onPress={() => playFrom(shown.id)}
              press="strong"
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel={`${isPlayingTrack(shown.id) ? t('komuzRoom.pause') : t('komuzRoom.play')} ${shown.title}`}
            >
              {isPlayingTrack(shown.id) ? <Pause size={isChild ? 34 : 28} color={colors.textPrimary} strokeWidth={2.5} /> : <Play size={isChild ? 34 : 28} color={colors.textPrimary} strokeWidth={2.5} />}
            </AnimatedPressable>
            <IconButton icon={SkipForward} size={isChild ? 56 : 48} iconSize={isChild ? 24 : 20} disabled={!hasNext} accessibilityLabel={t('komuzRoom.next')} onPress={() => useKomuzPlayerStore.getState().next()} />
          </View>
          {current && position > 0 ? (
            <AnimatedPressable
              style={styles.savePoint}
              onPress={() => {
                useListeningStore.getState().addBookmark(owner, { sourceType: 'komuz', sourceId: current.id, title: current.title, route: '/culture/komuz/listen', positionType: 'seconds', position });
                setSavedPoint(current.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={savedPoint === current.id ? t('listening.saved') : t('listening.savePoint')}
            >
              <Text style={styles.savePointText}>{savedPoint === current.id ? `✓ ${t('listening.saved')}` : t('listening.savePoint')}</Text>
            </AnimatedPressable>
          ) : null}
          {shown ? (
            <AnimatedPressable style={styles.savePoint} onPress={() => void shareContentLink({ type: 'komuz_track', id: shown.id, title: shown.title })} accessibilityRole="button" accessibilityLabel={t('contentLinks.shareTrack', { title: shown.title })}>
              <Text style={styles.savePointText}>{t('contentLinks.shareTrackShort')}</Text>
            </AnimatedPressable>
          ) : null}
          {/* Bundled with the app - plays without a connection. Not "downloaded". */}
          <Text style={styles.offline}>{t('komuzRoom.availableOffline')}</Text>
        </View>

        {/* Rhythm practice only exists for tracks with an authored, reviewed chart. */}
        {rhythmAvailable ? <Button label={t('rhythm.practice')} variant="secondary" onPress={() => router.push('/culture/komuz/rhythm' as never)} /> : null}
        {/* Authored practice exercises - needs no beat chart, so always offered. */}
        <Button label={t('rhythmRepeat.entry')} variant="secondary" onPress={() => router.push('/culture/komuz/repeat' as never)} testID="repeat-entry" />

        {recent.length > 0 && !isChild ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {t('komuzRoom.recentlyListened')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
              {recent.map((entry) => (
                <AnimatedPressable key={entry.id} style={styles.recentChip} onPress={() => playFrom(entry.id)} accessibilityRole="button" accessibilityLabel={`${t('komuzRoom.play')} ${entry.title}`}>
                  <Text style={styles.recentText} numberOfLines={1}>
                    {entry.title}
                  </Text>
                </AnimatedPressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {activeFilter === 'favorites' ? t('komuzRoom.favorites') : t('komuzRoom.allTracks')}
            </Text>
            {favoritesAvailable ? (
              <View style={styles.filters} accessibilityRole="radiogroup">
                {(['all', 'favorites'] as const).map((option) => (
                  <AnimatedPressable
                    key={option}
                    style={[styles.filter, activeFilter === option && styles.filterOn]}
                    onPress={() => setFilter(option)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: activeFilter === option }}
                    aria-checked={activeFilter === option}
                    accessibilityLabel={option === 'all' ? t('komuzRoom.allTracks') : t('komuzRoom.favorites')}
                  >
                    <Text style={[styles.filterText, activeFilter === option && styles.filterTextOn]}>{option === 'all' ? t('komuzRoom.all') : t('komuzRoom.favorites')}</Text>
                  </AnimatedPressable>
                ))}
              </View>
            ) : null}
          </View>
          {visible.map((entry) => {
            const isCurrent = entry.id === currentTrackId;
            const isFavorite = library.favorites.includes(entry.id);
            return (
              <View key={entry.id} style={[styles.row, isCurrent && styles.rowCurrent, isChild && styles.rowChild]}>
                <AnimatedPressable
                  style={styles.rowMain}
                  onPress={() => playFrom(entry.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${isPlayingTrack(entry.id) ? t('komuzRoom.pause') : t('komuzRoom.play')} ${entry.title}${entry.titleConfirmed ? '' : `. ${t('komuzRoom.titleUnconfirmed')}`}`}
                >
                  <View style={[styles.rowIcon, isPlayingTrack(entry.id) && styles.rowIconOn]}>
                    {isPlayingTrack(entry.id) ? <Pause size={16} color={colors.textOnDark} strokeWidth={2.5} /> : <Play size={16} color={colors.primary} strokeWidth={2.5} />}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.rowTitle, isChild && styles.rowTitleChild]} numberOfLines={1}>
                      {entry.title}
                    </Text>
                    {!isChild && entry.performer ? <Text style={styles.rowMeta}>{entry.performer}</Text> : null}
                    {!entry.titleConfirmed ? <Text style={styles.unconfirmedSmall}>{t('komuzRoom.titleUnconfirmed')}</Text> : null}
                  </View>
                  {/* Duration only when the player has reported it (current track). */}
                  {isCurrent && duration !== null ? <Text style={styles.rowMeta}>{clockTime(duration)}</Text> : null}
                </AnimatedPressable>
                <IconButton
                  icon={Heart}
                  size={36}
                  iconSize={16}
                  elevated={false}
                  variant={isFavorite ? 'primary' : 'surface'}
                  accessibilityLabel={`${isFavorite ? t('komuzRoom.removeFavorite') : t('komuzRoom.favorite')}: ${entry.title}`}
                  onPress={() => useKomuzLibraryStore.getState().toggleFavorite(owner, entry.id)}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/** Real seek for bundled recordings (only rendered with a real duration). */
function Scrubber({ position, duration, label, onSeek }: { position: number; duration: number; label: string; onSeek: (seconds: number) => void }) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  return (
    <Pressable
      style={styles.scrubber}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onPress={(event: GestureResponderEvent) => width > 0 && onSeek((event.nativeEvent.locationX / width) * duration)}
      hitSlop={{ top: 12, bottom: 12 }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={t('komuzRoom.position')}
      accessibilityValue={{ min: 0, max: Math.round(duration), now: Math.round(position), text: label }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => onSeek(position + (event.nativeEvent.actionName === 'increment' ? 10 : -10))}
    >
      <ProgressBar progress={duration > 0 ? position / duration : 0} height={6} fillColor={colors.accentGold} trackColor={colors.surfaceAlt} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  resume: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.accentGold },
  resumeText: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.primary, flex: 1 },
  savePoint: { minHeight: 32, justifyContent: 'center' },
  savePointText: { ...textStyles.small, fontWeight: '700', color: colors.primary },
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  titleEditorial: { ...editorial(typography.h1) },
  content: { paddingHorizontal: spacing.md, gap: spacing.lg },
  nowPlaying: { alignItems: 'center', gap: spacing.xs, padding: spacing.lg, borderRadius: radii.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  art: { width: 168, height: 168, borderRadius: radii.xl, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceFeature, marginBottom: spacing.sm },
  artChild: { width: 200, height: 200 },
  kicker: { ...typography.overline, color: colors.accentTerracotta },
  trackTitle: { ...textStyles.h2, color: colors.textPrimary, textAlign: 'center' },
  performer: { ...textStyles.body, color: colors.textSecondary },
  unconfirmed: { ...textStyles.small, color: colors.accentTerracotta, fontWeight: '700' },
  scrubber: { width: '100%', marginTop: spacing.sm, paddingVertical: spacing.xs },
  times: { width: '100%', flexDirection: 'row', justifyContent: 'space-between' },
  time: { ...textStyles.small, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm },
  playButton: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentGold },
  playButtonChild: { width: 84, height: 84, borderRadius: 42 },
  offline: { ...textStyles.small, color: colors.textMuted, marginTop: spacing.xs },
  section: { gap: spacing.xs },
  sectionTitle: { ...typography.overline, color: colors.accentTerracotta },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  filters: { flexDirection: 'row', gap: 4, padding: 3, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted },
  filter: { minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radii.pill },
  filterOn: { backgroundColor: colors.surfaceElevated },
  filterText: { ...textStyles.small, fontWeight: '700', color: colors.textSecondary },
  filterTextOn: { color: colors.textPrimary },
  recentRow: { gap: spacing.xs },
  recentChip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surfaceElevated, maxWidth: 200 },
  recentText: { ...textStyles.small, fontWeight: '700', color: colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingRight: spacing.xs, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: 'transparent' },
  rowCurrent: { borderColor: colors.primary },
  rowChild: { paddingVertical: spacing.xs },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56, paddingHorizontal: spacing.sm },
  rowIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  rowIconOn: { backgroundColor: colors.primary },
  rowTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  rowTitleChild: { fontSize: 18 },
  rowMeta: { ...textStyles.small, color: colors.textSecondary },
  unconfirmedSmall: { ...textStyles.small, color: colors.accentTerracotta },
});
