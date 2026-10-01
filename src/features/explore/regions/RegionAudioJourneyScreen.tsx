import { router } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, ExternalLink, Headphones } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AudioGuidePlayer } from '@/components/audio/AudioGuidePlayer';
import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';
import { NotFoundState } from '@/components/system/NotFoundState';
import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { track } from '@/services/analytics/analytics';
import { recordedAudioFor } from '@/services/audioGuide/contentAudio';
import { voiceMatchesLanguage, type VoiceInfo } from '@/services/audioGuide/narration';
import { isSpeechEngineAvailable, loadVoices, useAudioGuideStore } from '@/services/audioGuide/useAudioGuideStore';
import { useExploreRegions } from '@/services/content/exploreService';
import { mapExploreRegionName } from '@/services/content/types';
import { useAuthStore } from '@/store/useAuthStore';
import { colors, radii, spacing, textStyles, typography } from '@/theme';

import { listenedCount, resumeStopIndex, type JourneyStop } from './regionAudioJourney';
import { regionHubRoute } from './regionExperiences';
import { useRegionAudioJourney } from './useRegionAudioJourney';
import { useRegionAudioJourneyStore } from './useRegionAudioJourneyStore';
import { useRegionExperience } from './useRegionExperiences';

/**
 * /explore/region/[id]/audio - a region's Audio Journey on the existing
 * Audio Guide: one stop at a time, the listener moves on themselves (no
 * auto-advance), and coming back resumes at the stop they were on.
 * Listening never changes region progress and grants nothing.
 */
export function RegionAudioJourneyScreen({ regionId, onPressBack }: { regionId: string; onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const config = useRegionExperience(regionId);
  const { journey, isLoading, waitingForNetwork, retry } = useRegionAudioJourney(config);
  const { data: rows } = useExploreRegions();
  const owner = useAuthStore((state) => state.user?.id ?? 'guest');
  const store = useRegionAudioJourneyStore();
  const progress = store.saved[owner]?.[regionId];
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    void useRegionAudioJourneyStore.getState().load();
  }, []);

  // Resume once, after both the journey and the saved position are known.
  useEffect(() => {
    if (index !== null || !journey || !store.isLoaded) return;
    setIndex(resumeStopIndex(journey, progress));
    track('region_audio_journey_opened', { region_id: regionId, stops: journey.stops.length });
  }, [index, journey, store.isLoaded, progress, regionId]);

  // A switched account resumes from ITS own position.
  const ownerRef = useRef(owner);
  useEffect(() => {
    if (ownerRef.current === owner) return;
    ownerRef.current = owner;
    setIndex(null);
  }, [owner]);

  // The shared player hides itself when this device can't read the stop
  // (no recording and no voice for the language) - say why instead of
  // leaving an empty card.
  const [voices, setVoices] = useState<VoiceInfo[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadVoices().then((list) => {
      if (!cancelled) setVoices(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const stop: JourneyStop | null = journey && index !== null ? (journey.stops[Math.min(index, journey.stops.length - 1)] ?? null) : null;
  const sessionKey = stop ? `${stop.key}:${language}` : null;
  const canNarrate: boolean | null = !stop
    ? null
    : recordedAudioFor(stop.key, language)
      ? true
      : voices === null
        ? null
        : isSpeechEngineAvailable() && voices.some((voice) => voiceMatchesLanguage(voice.language, language));
  const finished = useAudioGuideStore((state) => !!sessionKey && state.sessionKey === sessionKey && state.status === 'finished');

  useEffect(() => {
    if (stop) useRegionAudioJourneyStore.getState().setCurrent(owner, regionId, stop.key);
  }, [stop, owner, regionId]);
  useEffect(() => {
    if (finished && stop) useRegionAudioJourneyStore.getState().markListened(owner, regionId, stop.key);
  }, [finished, stop, owner, regionId]);

  if (!config) return <NotFoundState onPressBack={onPressBack} />;
  if (waitingForNetwork) return <OfflineUnavailable onRetry={retry} />;
  if (isLoading || (journey && index === null)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const row = rows?.find((candidate) => candidate.id === regionId);
  const name = row ? (mapExploreRegionName(row)[language] ?? row.name_kg) : '';

  if (!journey || !stop || index === null) {
    return (
      <View style={[styles.root, styles.center, { padding: spacing.xl }]}>
        <Text style={styles.empty}>{t('regionHub.audio.none')}</Text>
        <Button label={t('regionHub.audio.backToRegion')} variant="secondary" onPress={() => router.replace(regionHubRoute(regionId) as never)} />
      </View>
    );
  }

  const go = (next: number) => {
    // Moving on stops the previous stop's narration; nothing plays by itself.
    if (sessionKey) useAudioGuideStore.getState().stop(sessionKey);
    setIndex(Math.max(0, Math.min(journey.stops.length - 1, next)));
  };
  const isLast = index === journey.stops.length - 1;
  const done = listenedCount(journey, progress);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>{t('regionHub.audio.title')}</Text>
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
            {name}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Text style={styles.meta} accessibilityLiveRegion="polite">
          {t('regionHub.audio.listened', { count: done, total: journey.stops.length })}
        </Text>

        <View style={styles.card}>
          <Text style={styles.stopNumber}>{t('regionHub.audio.stopOf', { current: index + 1, total: journey.stops.length })}</Text>
          <Text style={styles.stopTitle}>{stop.title}</Text>
          <Text style={styles.meta}>{t(`regionHub.audio.kind.${stop.kind}`)}</Text>
          <AudioGuidePlayer key={stop.key} contentKey={stop.key} narration={stop.narration} title={stop.title} />
          {canNarrate === false ? <Text style={styles.meta}>{t('regionHub.audio.noVoice')}</Text> : null}
          <AnimatedPressable style={styles.openLink} onPress={() => router.push(stop.route as never)} accessibilityRole="link" accessibilityLabel={t('regionHub.audio.openPage', { name: stop.title })}>
            <ExternalLink size={14} color={colors.primary} strokeWidth={2.25} />
            <Text style={styles.openText}>{t('regionHub.audio.openPageShort')}</Text>
          </AnimatedPressable>
          {finished ? <Text style={styles.finished}>{isLast ? t('regionHub.audio.allDone') : t('regionHub.audio.readyForNext')}</Text> : null}
          <View style={styles.nav}>
            <Button label={t('regionHub.audio.previous')} variant="secondary" disabled={index === 0} onPress={() => go(index - 1)} icon={<ChevronLeft size={16} color={colors.primary} strokeWidth={2.25} />} />
            {!isLast ? <Button label={t('regionHub.audio.next')} onPress={() => go(index + 1)} icon={<ChevronRight size={16} color={colors.textOnDark} strokeWidth={2.25} />} /> : null}
          </View>
        </View>

        <View style={{ gap: spacing.xs }}>
          {journey.stops.map((candidate, position) => {
            const heard = !!progress?.listened.includes(candidate.key);
            const current = position === index;
            return (
              <AnimatedPressable
                key={candidate.key}
                style={[styles.stopRow, current && styles.stopRowCurrent]}
                onPress={() => go(position)}
                accessibilityRole="button"
                accessibilityState={{ selected: current }}
                accessibilityLabel={`${t('regionHub.audio.stopOf', { current: position + 1, total: journey.stops.length })}. ${candidate.title}.${heard ? ` ${t('regionHub.audio.heard')}.` : ''}`}
              >
                <View style={[styles.dot, heard && styles.dotHeard]}>
                  {heard ? <Check size={12} color={colors.textOnDark} strokeWidth={3} /> : <Headphones size={12} color={colors.textMuted} strokeWidth={2.25} />}
                </View>
                <Text style={[styles.stopRowText, current && styles.stopRowTextCurrent]} numberOfLines={1}>
                  {position + 1}. {candidate.title}
                </Text>
              </AnimatedPressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  kicker: { ...typography.overline, color: colors.accentTerracotta },
  title: { ...typography.h2, color: colors.textPrimary },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  empty: { ...textStyles.body, color: colors.textSecondary, textAlign: 'center' },
  meta: { ...textStyles.small, color: colors.textSecondary },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  stopNumber: { ...typography.overline, color: colors.primary },
  stopTitle: { ...textStyles.h3, color: colors.textPrimary },
  openLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 36 },
  openText: { ...textStyles.small, color: colors.primary, fontWeight: '700' },
  finished: { ...textStyles.small, color: colors.primary, fontWeight: '700' },
  nav: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: radii.md },
  stopRowCurrent: { backgroundColor: colors.surfaceElevated },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  dotHeard: { backgroundColor: colors.primary },
  stopRowText: { ...textStyles.bodyMedium, color: colors.textSecondary, flex: 1 },
  stopRowTextCurrent: { color: colors.textPrimary, fontWeight: '700' },
});
