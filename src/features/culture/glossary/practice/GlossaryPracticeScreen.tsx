import { RecordingPresets, createAudioPlayer, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, type AudioPlayer } from 'expo-audio';
import { router } from 'expo-router';
import { ChevronLeft, Mic, Square, Volume2 } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import type { AgeExperience } from '@/services/ageExperience/types';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { track } from '@/services/analytics/analytics';
import { recordedAudioFor } from '@/services/audioGuide/contentAudio';
import type { VoiceInfo } from '@/services/audioGuide/narration';
import { isSpeechEngineAvailable, loadVoices } from '@/services/audioGuide/useAudioGuideStore';
import { useGlossaryStudyStore } from '@/store/useGlossaryStudyStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { useGlossary } from '../useGlossary';
import { deleteRecording, speakTerm, stopOtherAudio, stopTerm } from './practiceAudio';
import { MAX_RECORDING_MS, practiceEventProps, recordingSupport, referenceAudio, type ReferenceAudio, type SelfCheck } from './pronunciation';

/**
 * Listen & Repeat - hear the term, record yourself, listen back, try again.
 * Recordings stay on this device for this visit only: never uploaded,
 * synced, analyzed or stored. No score of any kind.
 */
export function GlossaryPracticeScreen({ termId, onPressBack }: { termId: string; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const { entries, isLoading } = useGlossary();
  const entry = entries.find(({ entry: candidate }) => candidate.id === termId)?.entry ?? null;
  const reference = useReference(entry?.term ?? null, entry ? `glossary:${entry.id}` : null);
  const support = recordingSupport();
  // Reference audio and the microphone are never used at the same time.
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (entry) track('pronunciation_practice_opened', practiceEventProps(entry.id));
    return () => stopTerm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id]);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.kicker}>{t('pronunciation.title')}</Text>
    </View>
  );
  if (isLoading || reference === null) {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }
  if (!entry) {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.center}>
          <Text style={styles.body}>{t('pronunciation.notFound')}</Text>
        </View>
      </View>
    );
  }

  const hear = () => {
    if (!recording) playReference(entry.term, reference);
  };
  return (
    <View style={styles.root}>
      {header}
      <View style={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Text style={styles.label}>{t('pronunciation.term')}</Text>
        <Text style={[styles.term, experience === 'child' && styles.termChild]} accessibilityRole="header">
          {entry.term}
        </Text>
        {reference.kind === 'unavailable' ? (
          <Text style={styles.notice} accessibilityLiveRegion="polite">
            {t('pronunciation.unavailable')}
          </Text>
        ) : (
          <Button label={t('pronunciation.hearTerm')} icon={<Volume2 size={18} color={colors.textOnPrimary} strokeWidth={2.25} />} size={experience === 'child' ? 'lg' : 'md'} block disabled={recording} onPress={hear} />
        )}

        {support === 'available' ? (
          <Recorder termId={entry.id} experience={experience} onHearTerm={reference.kind === 'unavailable' ? null : hear} onRecordingChange={setRecording} />
        ) : (
          <Text style={styles.notice}>{t(support === 'needs_app_update' ? 'pronunciation.recordingNeedsUpdate' : 'pronunciation.recordingUnsupported')}</Text>
        )}
      </View>
    </View>
  );
}

export function useReference(term: string | null, contentKey: string | null): ReferenceAudio | null {
  const recorded = contentKey ? recordedAudioFor(contentKey, 'kg') : null;
  const [voices, setVoices] = useState<VoiceInfo[] | null>(isSpeechEngineAvailable() ? null : []);
  useEffect(() => {
    if (voices !== null) return;
    let cancelled = false;
    void loadVoices().then((list) => !cancelled && setVoices(list));
    return () => {
      cancelled = true;
    };
  }, [voices]);
  if (!term || voices === null) return null;
  return referenceAudio(term, recorded, isSpeechEngineAvailable(), voices);
}

let referencePlayer: AudioPlayer | null = null;
function playReference(term: string, reference: ReferenceAudio): void {
  stopOtherAudio();
  referencePlayer?.remove();
  referencePlayer = null;
  if (reference.kind === 'tts') speakTerm(term, reference);
  else if (reference.kind === 'recorded') {
    referencePlayer = createAudioPlayer(reference.source);
    referencePlayer.play();
  }
}

/** Mounted only where recording is really possible in this build. */
function Recorder({ termId, experience, onHearTerm, onRecordingChange }: { termId: string; experience: AgeExperience; onHearTerm: (() => void) | null; onRecordingChange: (recording: boolean) => void }) {
  const { t } = useTranslation();
  const owner = useRecordsOwner();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [phase, setPhase] = useState<'ready' | 'recording' | 'recorded'>('ready');
  useEffect(() => onRecordingChange(phase === 'recording'), [phase, onRecordingChange]);
  const [uri, setUri] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [checked, setChecked] = useState<SelfCheck | null>(null);
  const uriRef = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const player = useRef<AudioPlayer | null>(null);

  const replaceRecording = (next: string | null) => {
    if (uriRef.current && uriRef.current !== next) deleteRecording(uriRef.current);
    uriRef.current = next;
    setUri(next);
  };

  const stop = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    try {
      await recorder.stop();
    } catch {
      // already stopped
    }
    const recorded = recorder.uri ?? null;
    replaceRecording(recorded);
    setPhase(recorded ? 'recorded' : 'ready');
    AccessibilityInfo.announceForAccessibility?.(t('pronunciation.recordingStopped'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder, t]);

  const start = async () => {
    // Permission is asked only now, on the first tap.
    const permission = await requestRecordingPermissionsAsync().catch(() => ({ granted: false }));
    if (!permission.granted) {
      setDenied(true);
      return;
    }
    setDenied(false);
    stopOtherAudio();
    player.current?.remove();
    player.current = null;
    replaceRecording(null);
    setChecked(null);
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      setPhase('ready');
      return;
    }
    track('pronunciation_record_started', practiceEventProps(termId));
    setPhase('recording');
    AccessibilityInfo.announceForAccessibility?.(t('pronunciation.recording'));
    timer.current = setTimeout(() => void stop(), MAX_RECORDING_MS);
  };

  const hearMine = () => {
    if (!uriRef.current) return;
    stopOtherAudio();
    player.current?.remove();
    player.current = createAudioPlayer(uriRef.current);
    player.current.play();
    AccessibilityInfo.announceForAccessibility?.(t('pronunciation.playback'));
  };

  // Backgrounded / interrupted: stop safely, never resume the microphone.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && phase === 'recording') void stop();
    });
    return () => subscription.remove();
  }, [phase, stop]);

  // Leaving the screen: stop and delete this visit's recording.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      try {
        if (recorder.isRecording) void recorder.stop();
      } catch {
        // already stopped
      }
      player.current?.remove();
      deleteRecording(uriRef.current);
      uriRef.current = null;
      void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const finish = (check: SelfCheck) => {
    setChecked(check);
    // "Practice again" = the existing glossary review state; no new queue.
    if (check === 'practice_again') useGlossaryStudyStore.getState().answer(owner, termId, 'review_again');
    track('pronunciation_practice_completed', practiceEventProps(termId));
  };

  const large = experience === 'child';
  return (
    <View style={styles.recorder}>
      <Text style={styles.label}>{t('pronunciation.nowYouTry')}</Text>
      {experience !== 'adult' && phase === 'ready' ? <Text style={styles.meta}>{t('pronunciation.privacy')}</Text> : null}
      {phase === 'recording' ? (
        <Button label={t('pronunciation.stop')} icon={<Square size={18} color={colors.textOnPrimary} fill={colors.textOnPrimary} strokeWidth={0} />} size="lg" block onPress={() => void stop()} accessibilityHint={t('pronunciation.recording')} />
      ) : phase === 'ready' ? (
        <Button label={t('pronunciation.record')} icon={<Mic size={large ? 24 : 18} color={colors.textOnPrimary} strokeWidth={2.25} />} size="lg" block onPress={() => void start()} />
      ) : null}
      {phase === 'recording' ? (
        <Text style={styles.recordingText} accessibilityLiveRegion="assertive">
          ● {t('pronunciation.recording')} · {t('pronunciation.maxLength')}
        </Text>
      ) : null}
      {denied ? <Text style={styles.notice}>{t('pronunciation.permissionDenied')}</Text> : null}

      {phase === 'recorded' && uri ? (
        <View style={{ gap: spacing.sm }}>
          {onHearTerm ? <Button label={t('pronunciation.hearTerm')} variant="secondary" block onPress={onHearTerm} /> : null}
          <Button label={t('pronunciation.hearMine')} variant="secondary" block onPress={hearMine} />
          <View style={styles.pair}>
            <View style={{ flex: 1 }}>
              <Button label={t('pronunciation.tryAgain')} variant="secondary" block onPress={() => void start()} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={t('pronunciation.done')} block onPress={() => (router.canGoBack() ? router.back() : router.replace('/culture/glossary' as never))} />
            </View>
          </View>
          <Text style={styles.label}>{t('pronunciation.howDidItFeel')}</Text>
          <View style={styles.pair}>
            <View style={{ flex: 1 }}>
              <Button label={t('pronunciation.easy')} variant={checked === 'easy' ? 'primary' : 'secondary'} block onPress={() => finish('easy')} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={t('pronunciation.practiceAgain')} variant={checked === 'practice_again' ? 'primary' : 'secondary'} block onPress={() => finish('practice_again')} />
            </View>
          </View>
          {checked === 'practice_again' ? <Text style={styles.meta}>{t('pronunciation.addedToReview')}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  kicker: { ...typography.overline, color: colors.accentTerracotta, flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  label: { ...typography.overline, color: colors.textSecondary },
  term: { ...typography.display, color: colors.textPrimary },
  termChild: { fontSize: 40, lineHeight: 48 },
  body: { ...textStyles.body, color: colors.textSecondary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  notice: { ...textStyles.small, color: colors.textSecondary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt },
  recorder: { gap: spacing.sm, marginTop: spacing.md },
  recordingText: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.accentTerracotta },
  pair: { flexDirection: 'row', gap: spacing.sm },
});

/**
 * Glossary term screen entry: shown ONLY when the term can really be
 * spoken (a recording or a device Kyrgyz voice) - never a dead button.
 */
export function ListenRepeatEntry({ entryId, term }: { entryId: string; term: string }) {
  const { t } = useTranslation();
  const reference = useReference(term, `glossary:${entryId}`);
  if (!reference || reference.kind === 'unavailable') return null;
  return <Button label={t('pronunciation.title')} variant="secondary" icon={<Volume2 size={18} color={colors.primary} strokeWidth={2.25} />} onPress={() => router.push(`/culture/glossary/${entryId}/practice` as never)} />;
}
