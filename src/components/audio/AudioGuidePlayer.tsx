import { Headphones, HeadphoneOff, Pause, Play, RotateCcw, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, ProgressBar } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { recordedAudioFor } from '@/services/audioGuide/contentAudio';
import { estimateListenMinutes, resolveAudioPlan, type Narration, type VoiceInfo } from '@/services/audioGuide/narration';
import { isSpeechEngineAvailable, loadVoices, useAudioGuideStore, type PlaybackRate } from '@/services/audioGuide/useAudioGuideStore';
import { colors, radii, spacing, typography } from '@/theme';

const RATES: PlaybackRate[] = [0.75, 1, 1.25];

type AudioGuidePlayerProps = {
  /** `<contentType>:<id>` - also the key into `contentAudio` recordings. */
  contentKey: string;
  /** The visible content to read, in the language it's written in. */
  narration: Narration | null;
  /** Daily OYNO shows the control only when audio actually works. */
  hideWhenUnavailable?: boolean;
};

function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/**
 * OYNO's compact audio guide - one control used by every detail screen.
 * Recorded narration (contentAudio) wins; otherwise device TTS, but only
 * when the text exists in the app language and the device has a real
 * voice for it; otherwise a short honest note. Playback belongs to the
 * single `useAudioGuideStore` session and stops when this control unmounts
 * (leaving the screen), the app backgrounds, or the language changes.
 */
export function AudioGuidePlayer({ contentKey, narration, hideWhenUnavailable = false }: AudioGuidePlayerProps) {
  const { t, i18n } = useTranslation();
  const appLanguage = i18n.language as SupportedLanguage;
  const sessionKey = `${contentKey}:${appLanguage}`;

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

  // Leaving the screen ends this narration (no background playback).
  useEffect(() => () => useAudioGuideStore.getState().stop(sessionKey), [sessionKey]);

  if (!plan) return null;

  if (plan.kind === 'unavailable') {
    if (hideWhenUnavailable || plan.reason === 'empty') return null;
    return (
      <View style={styles.unavailable}>
        <HeadphoneOff size={15} color={colors.textMuted} strokeWidth={2} />
        <Text style={styles.unavailableText}>{t(`audioGuide.unavailable.${plan.reason}`)}</Text>
      </View>
    );
  }

  const minutes = narration ? estimateListenMinutes(narration.text) : null;

  if (!active) {
    const label = minutes && plan.kind === 'tts' ? t('audioGuide.listenWithTime', { count: minutes }) : t('audioGuide.listen');
    return (
      <AnimatedPressable
        style={styles.listen}
        onPress={() => useAudioGuideStore.getState().start(sessionKey, plan)}
        press="strong"
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Headphones size={16} color={colors.primary} strokeWidth={2.25} />
        <Text style={styles.listenText}>{label}</Text>
      </AnimatedPressable>
    );
  }

  const isPlaying = status === 'playing';
  const store = useAudioGuideStore.getState();

  return (
    <View style={styles.player}>
      <View style={styles.row}>
        <AnimatedPressable
          style={styles.playButton}
          onPress={store.toggle}
          press="strong"
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? t('audioGuide.pause') : t('audioGuide.play')}
        >
          {isPlaying ? <Pause size={18} color={colors.accentGold} strokeWidth={2.5} /> : <Play size={18} color={colors.accentGold} strokeWidth={2.5} />}
        </AnimatedPressable>

        <View style={styles.track}>
          <View style={styles.trackHeader}>
            <OymoOrnament size={9} color={colors.accentGoldPressed} strokeWidth={1.75} />
            <Text style={styles.trackLabel} numberOfLines={1}>
              {status === 'error' ? t('audioGuide.error') : status === 'finished' ? t('audioGuide.finished') : t('audioGuide.nowListening')}
            </Text>
            {duration ? (
              <Text style={styles.time}>
                {formatTime(elapsed ?? 0)} / {formatTime(duration)}
              </Text>
            ) : null}
          </View>
          <ProgressBar progress={progress} height={4} fillColor={colors.accentGold} trackColor={colors.surfaceAlt} />
        </View>

        <AnimatedPressable style={styles.iconButton} onPress={store.restart} hitSlop={6} press="strong" accessibilityRole="button" accessibilityLabel={t('audioGuide.restart')}>
          <RotateCcw size={16} color={colors.primary} strokeWidth={2.25} />
        </AnimatedPressable>
        <AnimatedPressable style={styles.iconButton} onPress={() => store.stop(sessionKey)} hitSlop={6} press="strong" accessibilityRole="button" accessibilityLabel={t('audioGuide.stop')}>
          <X size={16} color={colors.textSecondary} strokeWidth={2.25} />
        </AnimatedPressable>
      </View>

      <View style={styles.rates} accessibilityRole="radiogroup">
        {RATES.map((option) => (
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
  unavailable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  unavailableText: {
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
