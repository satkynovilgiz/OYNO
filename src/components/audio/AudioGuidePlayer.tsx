import { usePathname } from 'expo-router';
import { CloudOff, Headphones, Pause, Play, RotateCcw, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, ProgressBar } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { recordedAudioFor } from '@/services/audioGuide/contentAudio';
import { estimateListenMinutes, formatAudioTime, isPlayableNow, offlineAvailabilityFor, resolveAudioPlan, type Narration, type VoiceInfo } from '@/services/audioGuide/narration';
import { isSpeechEngineAvailable, loadVoices, PLAYBACK_RATES, useAudioGuideStore } from '@/services/audioGuide/useAudioGuideStore';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { colors, radii, spacing, typography } from '@/theme';

type AudioGuidePlayerProps = {
  /** `<contentType>:<id>` - also the key into `contentAudio` recordings. */
  contentKey: string;
  /** The visible content to read, in the language it's written in. */
  narration: Narration | null;
  /** Shown in the mini player once the listener leaves this screen. */
  title: string;
};

/**
 * OYNO's audio guide - the one listening control every detail screen uses
 * (Culture item, Material, Explore destination, Daily). Recorded narration
 * (contentAudio) wins; otherwise device TTS, but only when the text exists
 * in the app language and the device has a real voice for it. When neither
 * works, nothing is shown - no dead Play button.
 *
 * Playback belongs to the single `useAudioGuideStore` session: starting
 * another narration stops this one, leaving the screen hands it to the mini
 * player, backgrounding the app pauses it, and a language change stops it.
 */
export function AudioGuidePlayer({ contentKey, narration, title }: AudioGuidePlayerProps) {
  const { t, i18n } = useTranslation();
  const appLanguage = i18n.language as SupportedLanguage;
  const sessionKey = `${contentKey}:${appLanguage}`;
  const route = usePathname();
  const { isOffline } = useNetworkStatus();

  const recorded = recordedAudioFor(contentKey, appLanguage);
  const needsVoices = !recorded && !!narration && narration.lang === appLanguage && isSpeechEngineAvailable();
  const [voices, setVoices] = useState<VoiceInfo[] | null>(needsVoices ? null : []);

  useEffect(() => {
    if (!needsVoices) return;
    let cancelled = false;
    void loadVoices().then((list) => {
      if (!cancelled) setVoices(list);
    });
    return () => {
      cancelled = true;
    };
  }, [needsVoices]);

  const plan = useMemo(
    () => (voices === null ? null : resolveAudioPlan({ appLanguage, narration, recorded, ttsAvailable: isSpeechEngineAvailable(), voices })),
    [appLanguage, narration, recorded, voices],
  );

  const active = useAudioGuideStore((state) => state.sessionKey === sessionKey);
  const status = useAudioGuideStore((state) => state.status);
  const progress = useAudioGuideStore((state) => state.progress);
  const elapsed = useAudioGuideStore((state) => state.elapsed);
  const duration = useAudioGuideStore((state) => state.duration);
  const rate = useAudioGuideStore((state) => state.rate);
  const canSeek = useAudioGuideStore((state) => state.canSeek);

  // While this screen shows the full player, the mini player stays hidden.
  useEffect(() => useAudioGuideStore.getState().registerHost(sessionKey), [sessionKey]);

  if (!plan || plan.kind === 'unavailable') return null;

  const availability = offlineAvailabilityFor(plan);
  if (!active && !isPlayableNow(availability, isOffline)) {
    return (
      <View style={styles.offline} accessible accessibilityLabel={t('audioGuide.unavailableOffline')}>
        <CloudOff size={15} color={colors.textMuted} strokeWidth={2} />
        <Text style={styles.offlineText}>{t('audioGuide.unavailableOffline')}</Text>
      </View>
    );
  }

  const store = useAudioGuideStore.getState();

  if (!active) {
    const minutes = narration && plan.kind === 'tts' ? estimateListenMinutes(narration.text) : null;
    const label = minutes ? t('audioGuide.listenWithTime', { count: minutes }) : t('audioGuide.listen');
    return (
      <AnimatedPressable
        style={styles.listen}
        onPress={() => store.start(sessionKey, plan, { title, route })}
        press="strong"
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel={`${t('audioGuide.title')}: ${label}`}
      >
        <Headphones size={16} color={colors.primary} strokeWidth={2.25} />
        <Text style={styles.listenText}>{label}</Text>
      </AnimatedPressable>
    );
  }

  const isPlaying = status === 'playing';
  const toggleLabel = isPlaying ? t('audioGuide.pause') : status === 'paused' ? t('audioGuide.resume') : t('audioGuide.play');
  const progressText = duration ? t('audioGuide.timeOf', { elapsed: formatAudioTime(elapsed ?? 0), duration: formatAudioTime(duration) }) : t('audioGuide.percent', { percent: Math.round(progress * 100) });

  return (
    <View style={styles.player}>
      <View style={styles.row}>
        <AnimatedPressable style={styles.playButton} onPress={store.toggle} press="strong" haptic="light" accessibilityRole="button" accessibilityLabel={toggleLabel}>
          {isPlaying ? <Pause size={18} color={colors.accentGold} strokeWidth={2.5} /> : <Play size={18} color={colors.accentGold} strokeWidth={2.5} />}
        </AnimatedPressable>

        <View style={styles.track}>
          <View style={styles.trackHeader}>
            <OymoOrnament size={9} color={colors.accentGoldPressed} strokeWidth={1.75} />
            <Text style={styles.trackLabel} numberOfLines={1}>
              {status === 'error' ? t('audioGuide.error') : status === 'finished' ? t('audioGuide.finished') : t('audioGuide.title')}
            </Text>
            {duration ? (
              <Text style={styles.time}>
                {formatAudioTime(elapsed ?? 0)} / {formatAudioTime(duration)}
              </Text>
            ) : null}
          </View>
          {canSeek && duration ? (
            <SeekBar progress={progress} valueText={progressText} onSeek={store.seek} />
          ) : (
            <View accessible accessibilityRole="progressbar" accessibilityLabel={t('audioGuide.progress')} accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100), text: progressText }}>
              <ProgressBar progress={progress} height={4} fillColor={colors.accentGold} trackColor={colors.surfaceAlt} />
            </View>
          )}
        </View>

        <AnimatedPressable style={styles.iconButton} onPress={store.restart} hitSlop={6} press="strong" accessibilityRole="button" accessibilityLabel={t('audioGuide.restart')}>
          <RotateCcw size={16} color={colors.primary} strokeWidth={2.25} />
        </AnimatedPressable>
        <AnimatedPressable style={styles.iconButton} onPress={() => store.stop(sessionKey)} hitSlop={6} press="strong" accessibilityRole="button" accessibilityLabel={t('audioGuide.stop')}>
          <X size={16} color={colors.textSecondary} strokeWidth={2.25} />
        </AnimatedPressable>
      </View>

      <View style={styles.rates} accessibilityRole="radiogroup" accessibilityLabel={t('audioGuide.playbackSpeed')}>
        {PLAYBACK_RATES.map((option) => (
          <AnimatedPressable
            key={option}
            style={[styles.rate, rate === option && styles.rateActive]}
            onPress={() => store.setRate(option)}
            hitSlop={8}
            press="strong"
            accessibilityRole="radio"
            accessibilityState={{ checked: rate === option }}
            accessibilityLabel={t('audioGuide.speed', { rate: option })}
          >
            <Text style={[styles.rateText, rate === option && styles.rateTextActive]}>{option}×</Text>
          </AnimatedPressable>
        ))}
      </View>
    </View>
  );
}

/** Tap-to-seek progress for recordings (the only audio that can seek);
 * screen readers adjust it in 10% steps. */
function SeekBar({ progress, valueText, onSeek }: { progress: number; valueText: string; onSeek: (fraction: number) => void }) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  return (
    <Pressable
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onPress={(event: GestureResponderEvent) => width > 0 && onSeek(event.nativeEvent.locationX / width)}
      hitSlop={{ top: 12, bottom: 12 }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={t('audioGuide.progress')}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100), text: valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => onSeek(progress + (event.nativeEvent.actionName === 'increment' ? 0.1 : -0.1))}
    >
      <ProgressBar progress={progress} height={6} fillColor={colors.accentGold} trackColor={colors.surfaceAlt} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listen: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
  },
  listenText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  offlineText: {
    ...typography.small,
    fontWeight: '500',
    color: colors.textMuted,
    flex: 1,
  },
  player: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.xl,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    flex: 1,
    gap: 6,
  },
  trackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackLabel: {
    ...typography.small,
    color: colors.textSecondary,
    flex: 1,
  },
  time: {
    ...typography.small,
    color: colors.textSecondary,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rates: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingLeft: 40 + spacing.sm,
  },
  rate: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  rateActive: {
    backgroundColor: colors.surfaceAlt,
  },
  rateText: {
    ...typography.small,
    color: colors.textMuted,
  },
  rateTextActive: {
    color: colors.primary,
  },
});
