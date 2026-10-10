import { Mic, Play, Square } from 'lucide-react-native';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, StyleSheet, Text, View } from 'react-native';

import { Button, TextField } from '@/components/ui';
import { recordingSupport } from '@/features/culture/glossary/practice/pronunciation';
import { announce } from '@/services/a11y/announce';
import { narrationAudio } from '@/services/museum/narrationAudio';
import { deleteTempRecording as deleteRecording, playNarration, PREVIEW_ID, previewRecording, stopNarration, stopOtherAppAudio as stopOtherAudio, useNarrationPlayer } from '@/services/museum/narrationPlayer';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

import { attachRecording, detachRecording, formatDuration, MAX_NARRATION_MS, NARRATION_TEXT_MAX, RECORDER_IDLE, recorderReducer, setNarrationText, tempOf, type Narration } from './narrationModel';

type Narrations = Record<string, Narration>;
/** Applies a change to the LATEST stored narrations (not a stale copy) and returns what was saved. */
export type CommitNarrations = (change: (narrations: Narrations) => Narrations) => void;

/**
 * Exhibition editing: the curator's narration for ONE exhibit. Recording
 * is offered only where this build can really record (recordingSupport);
 * written narration is always available. A recording is saved only after
 * "Save recording", and a replacement removes the previous one only once
 * the new one is saved.
 */
export function NarrationEditor({ owner, exhibitKey, title, narration, commit }: { owner: string; exhibitKey: string; title: string; narration: Narration | null; commit: CommitNarrations }) {
  const { t } = useTranslation();
  const support = recordingSupport();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hasAudio = !!narration?.audioId;

  const removeRecording = () => {
    let released: string | null = null;
    commit((narrations) => {
      const result = detachRecording(narrations, exhibitKey);
      released = result.released;
      return result.narrations;
    });
    if (released) {
      if (useNarrationPlayer.getState().playingId === released) stopNarration();
      void narrationAudio()
        .remove(owner, released)
        .catch(() => undefined);
    }
    setConfirmDelete(false);
    announce(t('museum.narration.deleted'));
  };

  return (
    <View style={styles.box} testID="narration-editor">
      <Text style={styles.label}>{t('museum.narration.title', { name: title })}</Text>
      {hasAudio && narration ? (
        <View style={styles.stack}>
          <Text style={styles.meta} testID="narration-saved">
            {t('museum.narration.saved', { duration: formatDuration(narration.durationMs) })}
          </Text>
          <View style={styles.row}>
            <PlayButton owner={owner} audioId={narration.audioId as string} testID="narration-play-saved" />
            {confirmDelete ? (
              <>
                <Button label={t('museum.narration.confirmDelete')} variant="danger" size="sm" onPress={removeRecording} testID="narration-delete-confirm" />
                <Button label={t('museum.narration.keep')} variant="text" size="sm" onPress={() => setConfirmDelete(false)} />
              </>
            ) : (
              <Button label={t('museum.narration.delete')} variant="text" size="sm" onPress={() => setConfirmDelete(true)} testID="narration-delete" />
            )}
          </View>
        </View>
      ) : null}

      {support === 'available' ? (
        <Recorder owner={owner} exhibitKey={exhibitKey} replacing={hasAudio} commit={commit} />
      ) : (
        <Text style={styles.meta} testID="narration-unavailable">
          {t(support === 'needs_app_update' ? 'museum.narration.needsUpdate' : 'museum.narration.unsupported')}
        </Text>
      )}

      <TextField
        testID="narration-text"
        label={hasAudio ? t('museum.narration.transcriptLabel') : t('museum.narration.writtenLabel')}
        value={narration?.text ?? ''}
        onChangeText={(value) => commit((narrations) => setNarrationText(narrations, exhibitKey, value.slice(0, NARRATION_TEXT_MAX)))}
        multiline
        numberOfLines={3}
        placeholder={t('museum.narration.textPlaceholder')}
      />
      <Text style={styles.meta}>{t('museum.narration.textNote')}</Text>
      <Text style={styles.meta} testID="narration-storage-note">
        {t('museum.narration.storageNote')}
      </Text>
    </View>
  );
}

function PlayButton({ owner, audioId, testID }: { owner: string; audioId: string; testID: string }) {
  const { t } = useTranslation();
  const playing = useNarrationPlayer((state) => state.playingId === audioId);
  const [missing, setMissing] = useState(false);
  return (
    <>
      <Button
        label={playing ? t('museum.narration.stop') : t('museum.narration.play')}
        icon={playing ? <Square size={14} color={colors.primary} fill={colors.primary} strokeWidth={0} /> : <Play size={14} color={colors.primary} strokeWidth={2.25} />}
        variant="secondary"
        size="sm"
        onPress={async () => {
          if (playing) return stopNarration();
          setMissing(!(await playNarration(owner, audioId, stopOtherAudio)));
        }}
        testID={testID}
      />
      {missing ? (
        <Text style={styles.meta} testID="narration-missing">
          {t('museum.narration.missing')}
        </Text>
      ) : null}
    </>
  );
}

/** Mounted only where recording is really possible in this build. */
function Recorder({ owner, exhibitKey, replacing, commit }: { owner: string; exhibitKey: string; replacing: boolean; commit: CommitNarrations }) {
  const { t } = useTranslation();
  // Loaded lazily (like the other audio modules): only where recording is really possible.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } = require('expo-audio') as typeof import('expo-audio');
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [phase, dispatch] = useReducer(recorderReducer, RECORDER_IDLE);
  const [elapsed, setElapsed] = useState(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const limit = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewPlaying = useNarrationPlayer((state) => state.playingId === PREVIEW_ID);

  const clearTimers = () => {
    if (limit.current) clearTimeout(limit.current);
    if (tick.current) clearInterval(tick.current);
    limit.current = null;
    tick.current = null;
  };

  const stop = useCallback(async () => {
    clearTimers();
    try {
      await recorder.stop();
    } catch {
      // already stopped
    }
    dispatch({ type: 'stopped', tempUri: recorder.uri ?? null, at: Date.now() });
    void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    announce(t('museum.narration.stopped'));
  }, [recorder, t]);

  const start = async () => {
    // The OS prompt only after the explanation, on the curator's tap.
    const permission = await requestRecordingPermissionsAsync().catch(() => ({ granted: false }));
    dispatch({ type: 'permission', granted: permission.granted });
    if (!permission.granted) return;
    stopNarration();
    stopOtherAudio();
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      dispatch({ type: 'startFailed' });
      return;
    }
    const at = Date.now();
    dispatch({ type: 'started', at });
    setElapsed(0);
    tick.current = setInterval(() => setElapsed(Date.now() - at), 500);
    limit.current = setTimeout(() => void stop(), MAX_NARRATION_MS);
    announce(t('museum.narration.recording'));
  };

  /** Removes the temporary recording (blob / cache file); the saved one is untouched. */
  const discard = () => {
    const temp = tempOf(phaseRef.current);
    if (useNarrationPlayer.getState().playingId === PREVIEW_ID) stopNarration();
    deleteRecording(temp);
    dispatch({ type: 'discard' });
  };

  const save = async () => {
    if (phase.kind !== 'review') return;
    const { tempUri, durationMs } = phase;
    if (useNarrationPlayer.getState().playingId === PREVIEW_ID) stopNarration();
    dispatch({ type: 'save' });
    let id: string;
    try {
      id = await narrationAudio().save(owner, tempUri);
    } catch {
      // Nothing changed: the previous recording (if any) is still the saved one.
      deleteRecording(tempUri);
      dispatch({ type: 'saveFailed' });
      announce(t('museum.narration.saveFailed'));
      return;
    }
    let released: string | null = null;
    commit((narrations) => {
      const result = attachRecording(narrations, exhibitKey, id, durationMs);
      released = result.released;
      return result.narrations;
    });
    // Only now, with the new one saved and referenced, the previous recording goes.
    if (released) await narrationAudio().remove(owner, released).catch(() => undefined);
    deleteRecording(tempUri);
    dispatch({ type: 'saved' });
    announce(t('museum.narration.savedAnnounce'));
  };

  // Backgrounded while recording: stop (the take goes to review, nothing is saved by itself).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && phaseRef.current.kind === 'recording') void stop();
    });
    return () => subscription.remove();
  }, [stop]);

  // Leaving editing / another account: stop and delete the unsaved take.
  useEffect(
    () => () => {
      clearTimers();
      try {
        if (recorder.isRecording) void recorder.stop();
      } catch {
        // already stopped
      }
      if (useNarrationPlayer.getState().playingId === PREVIEW_ID) stopNarration();
      deleteRecording(tempOf(phaseRef.current));
      void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (phase.kind === 'idle' && !phase.explain) {
    return <Button label={replacing ? t('museum.narration.recordReplacement') : t('museum.narration.record')} icon={<Mic size={14} color={colors.primary} strokeWidth={2.25} />} variant="secondary" size="sm" onPress={() => dispatch({ type: 'ask' })} testID="narration-record" />;
  }
  if (phase.kind === 'idle') {
    return (
      <View style={styles.panel} testID="narration-permission">
        <Text style={styles.body}>{t('museum.narration.permissionExplain', { seconds: MAX_NARRATION_MS / 1000 })}</Text>
        <View style={styles.row}>
          <Button label={t('museum.narration.allowAndRecord')} size="sm" onPress={() => void start()} testID="narration-allow" />
          <Button label={t('museum.narration.notNow')} variant="text" size="sm" onPress={() => dispatch({ type: 'dismiss' })} testID="narration-not-now" />
        </View>
      </View>
    );
  }
  if (phase.kind === 'denied') {
    return (
      <View style={styles.panel} testID="narration-denied">
        <Text style={styles.body}>{t('museum.narration.denied')}</Text>
        <Button label={t('museum.narration.tryAgain')} variant="text" size="sm" onPress={() => dispatch({ type: 'ask' })} />
      </View>
    );
  }
  if (phase.kind === 'recording') {
    return (
      <View style={styles.panel} testID="narration-recording">
        <Text style={styles.body} accessibilityLiveRegion="polite">
          {t('museum.narration.recordingTime', { elapsed: formatDuration(elapsed), max: formatDuration(MAX_NARRATION_MS) })}
        </Text>
        <Button label={t('museum.narration.stopRecording')} icon={<Square size={14} color={colors.textOnPrimary} fill={colors.textOnPrimary} strokeWidth={0} />} size="sm" onPress={() => void stop()} testID="narration-stop" />
      </View>
    );
  }
  if (phase.kind === 'review' || phase.kind === 'saving') {
    return (
      <View style={styles.panel} testID="narration-review">
        <Text style={styles.body}>{t('museum.narration.review', { duration: formatDuration(phase.durationMs) })}</Text>
        {phase.kind === 'review' && phase.limitReached ? <Text style={styles.meta}>{t('museum.narration.limitReached', { seconds: MAX_NARRATION_MS / 1000 })}</Text> : null}
        {replacing ? <Text style={styles.meta}>{t('museum.narration.replaceNote')}</Text> : null}
        <View style={styles.row}>
          <Button label={previewPlaying ? t('museum.narration.stop') : t('museum.narration.preview')} variant="secondary" size="sm" disabled={phase.kind === 'saving'} onPress={() => (previewPlaying ? stopNarration() : void previewRecording(phase.tempUri, stopOtherAudio))} testID="narration-preview" />
          <Button label={t('museum.narration.save')} size="sm" disabled={phase.kind === 'saving'} onPress={() => void save()} testID="narration-save" />
          <Button label={t('museum.narration.discard')} variant="text" size="sm" disabled={phase.kind === 'saving'} onPress={discard} testID="narration-discard" />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.panel} testID="narration-failed">
      <Text style={styles.body}>{phase.reason === 'save' ? t('museum.narration.saveFailed') : t('museum.narration.startFailed')}</Text>
      <Button label={t('museum.narration.tryAgain')} variant="text" size="sm" onPress={() => dispatch({ type: 'ask' })} testID="narration-retry" />
    </View>
  );
}

/**
 * Visiting: the curator's narration for the exhibit on screen - clearly
 * labelled as the curator's, with the written words (if any) beside it.
 * Stops when the exhibit changes or the visit ends (unmount).
 */
export function NarrationPlayback({ owner, narration, big }: { owner: string; narration: Narration | null | undefined; big?: boolean }) {
  const { t } = useTranslation();
  const audioId = narration?.audioId ?? null;
  useEffect(
    () => () => {
      if (audioId && useNarrationPlayer.getState().playingId === audioId) stopNarration();
    },
    [audioId],
  );
  if (!narration || (!audioId && !narration.text.trim())) return null;
  return (
    <View style={styles.visitor} testID="narration-visitor">
      <Text style={styles.overline}>{t('museum.narration.curatorLabel')}</Text>
      {audioId ? (
        <View style={styles.row}>
          <PlayButton owner={owner} audioId={audioId} testID="narration-play" />
          <Text style={styles.meta}>{formatDuration(narration.durationMs)}</Text>
        </View>
      ) : null}
      {narration.text.trim() ? (
        <View style={styles.stack} testID="narration-visitor-text">
          <Text style={styles.meta}>{audioId ? t('museum.narration.transcriptByCurator') : t('museum.narration.writtenByCurator')}</Text>
          <Text style={[styles.body, big && styles.bodyLarge]}>{narration.text}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.compact, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  panel: { gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt },
  visitor: { gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt, borderLeftWidth: 3, borderLeftColor: colors.accentBrown },
  stack: { gap: 2 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  label: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  overline: { ...textStyles.overline, color: colors.textPrimary },
  body: { ...textStyles.body, color: colors.textPrimary },
  bodyLarge: { fontSize: 19, lineHeight: 27 },
  meta: { ...textStyles.small, color: colors.textSecondary },
});
