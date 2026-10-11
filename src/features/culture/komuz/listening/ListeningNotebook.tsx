import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, Button, TextField } from '@/components/ui';
import { komuzTracks } from '@/features/culture/audioData';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { announce } from '@/services/a11y/announce';
import { ownerNotebook, useListeningNotebookStore } from '@/store/useListeningNotebookStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { clockTime, realDuration, spokenTime } from './komuzQueue';
import { groupedMoments, NOTE_MAX, seekPlan, type Moment } from './notebookModel';
import { useKomuzPlayerStore } from './useKomuzPlayerStore';

type Pending = { trackId: string; title: string; position: number; duration: number | null };

/**
 * Listening Notebook in the Komuz Listening Room. "Save this moment" keeps
 * the position the existing player reports at the tap; a moment's note is
 * the listener's own words. Tapping a moment seeks the SAME player (or
 * starts that track there). Editing a note never touches playback.
 */
export function ListeningNotebook() {
  const { t } = useTranslation();
  const owner = useRecordsOwner();
  const status = useListeningNotebookStore((state) => state.status);
  const notebook = ownerNotebook(useListeningNotebookStore((state) => state.saved), owner);
  const currentTrackId = useKomuzPlayerStore((state) => state.currentTrackId);
  const position = useKomuzPlayerStore((state) => state.position);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [failedCapture, setFailedCapture] = useState<Pending | null>(null);
  const [failedNote, setFailedNote] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: string; kind: 'notSeekable' | 'missing' } | null>(null);
  useEffect(() => {
    void useListeningNotebookStore.getState().load();
  }, []);
  const shownOwner = useRef(owner);
  useEffect(() => {
    if (shownOwner.current === owner) return;
    shownOwner.current = owner;
    setEditing(null);
    setFailedCapture(null);
    setFailedNote(null);
    setNotice(null);
  }, [owner]);

  const current = komuzTracks.find((entry) => entry.id === currentTrackId) ?? null;
  const capture = async (pending: Pending) => {
    const moment = await useListeningNotebookStore.getState().capture(owner, pending);
    if (!moment) {
      setFailedCapture(pending);
      announce(t('listeningNotebook.saveFailed'));
      return;
    }
    setFailedCapture(null);
    setEditing({ id: moment.id, text: '' });
    announce(t('listeningNotebook.savedAt', { time: spokenTime(moment.seconds, t) }));
  };
  const saveMoment = () => {
    if (!current) return;
    // The ACTUAL position right now, from the existing player.
    const player = useKomuzPlayerStore.getState();
    void capture({ trackId: current.id, title: current.title, position: player.position, duration: realDuration(player.duration) });
  };
  const saveNote = async () => {
    if (!editing) return;
    const ok = await useListeningNotebookStore.getState().setNote(owner, editing.id, editing.text);
    if (!ok) {
      setFailedNote(editing.id);
      announce(t('listeningNotebook.saveFailed'));
      return;
    }
    setFailedNote(null);
    setEditing(null);
  };
  const go = (moment: Moment) => {
    const player = useKomuzPlayerStore.getState();
    const plan = seekPlan(moment, { currentTrackId: player.currentTrackId, duration: realDuration(player.duration) }, komuzTracks.some((entry) => entry.id === moment.trackId));
    if (plan.kind === 'seek') player.seek(plan.seconds);
    else if (plan.kind === 'playFrom') player.playFrom(moment.trackId, plan.seconds);
    setNotice(plan.kind === 'notSeekable' || plan.kind === 'missing' ? { id: moment.id, kind: plan.kind } : null);
    if (plan.kind === 'seek' || plan.kind === 'playFrom') announce(t('listeningNotebook.jumped', { time: spokenTime(plan.seconds, t) }));
  };

  const groups = groupedMoments(notebook, komuzTracks.map((entry) => entry.id));
  return (
    <View style={styles.section} testID="listening-notebook">
      <Text style={styles.title} accessibilityRole="header">
        {t('listeningNotebook.title')}
      </Text>
      <Text style={styles.meta}>{t('listeningNotebook.intro')}</Text>
      {status === 'error' ? (
        <View style={styles.card} testID="notebook-load-error">
          <Text style={styles.body}>{t('listeningNotebook.loadError')}</Text>
          <Button label={t('listeningNotebook.retry')} size="sm" onPress={() => void useListeningNotebookStore.getState().retryLoad()} />
        </View>
      ) : null}
      {current ? (
        <Button label={t('listeningNotebook.saveMoment', { time: clockTime(position) })} variant="secondary" disabled={status !== 'ready'} accessibilityHint={t('listeningNotebook.saveMomentHint')} onPress={saveMoment} testID="notebook-save-moment" />
      ) : (
        <Text style={styles.meta}>{t('listeningNotebook.playFirst')}</Text>
      )}
      {failedCapture ? (
        <View style={styles.error} testID="notebook-capture-failed">
          <Text style={styles.body}>{t('listeningNotebook.saveFailed')}</Text>
          <Button label={t('listeningNotebook.retry')} size="sm" onPress={() => void capture(failedCapture)} testID="notebook-capture-retry" />
        </View>
      ) : null}
      {status === 'ready' && groups.length === 0 ? <Text style={styles.meta}>{t('listeningNotebook.none')}</Text> : null}
      {groups.map((group) => {
        const track = komuzTracks.find((entry) => entry.id === group.trackId) ?? null;
        return (
          <View key={group.trackId} style={styles.group} testID={`notebook-track-${group.trackId}`}>
            <Text style={styles.trackTitle}>{track?.title ?? group.moments[0]?.titleSnapshot}</Text>
            {!track ? <Text style={styles.warn} testID="notebook-track-missing">{t('listeningNotebook.trackMissing')}</Text> : null}
            {group.moments.map((moment) => {
              const isEditing = editing?.id === moment.id;
              return (
                <View key={moment.id} style={styles.moment} testID={`notebook-moment-${moment.id}`}>
                  <AnimatedPressable style={styles.time} onPress={() => go(moment)} disabled={!track} accessibilityRole="button" accessibilityLabel={t('listeningNotebook.goA11y', { time: spokenTime(moment.seconds, t), title: track?.title ?? moment.titleSnapshot })} testID={`notebook-go-${moment.id}`}>
                    <Text style={styles.timeText}>{clockTime(moment.seconds)}</Text>
                  </AnimatedPressable>
                  <View style={styles.flex}>
                    {isEditing ? (
                      <>
                        <TextField testID={`notebook-note-${moment.id}`} label={t('listeningNotebook.noteLabel')} value={editing.text} onChangeText={(text) => setEditing({ id: moment.id, text: text.slice(0, NOTE_MAX) })} multiline placeholder={t('listeningNotebook.notePlaceholder')} />
                        {failedNote === moment.id ? <Text style={styles.warn}>{t('listeningNotebook.saveFailed')}</Text> : null}
                        <View style={styles.row}>
                          <Button label={failedNote === moment.id ? t('listeningNotebook.retry') : t('listeningNotebook.saveNote')} size="sm" onPress={() => void saveNote()} testID={`notebook-save-note-${moment.id}`} />
                          <Button label={t('listeningNotebook.cancel')} variant="text" size="sm" onPress={() => { setEditing(null); setFailedNote(null); }} />
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={styles.label}>{t('listeningNotebook.yourNote')}</Text>
                        <Text style={styles.body} testID={`notebook-note-text-${moment.id}`}>
                          {moment.note || t('listeningNotebook.noNote')}
                        </Text>
                        <View style={styles.row}>
                          <Button label={t('listeningNotebook.editNote')} variant="text" size="sm" onPress={() => setEditing({ id: moment.id, text: moment.note })} testID={`notebook-edit-${moment.id}`} />
                          <Button label={t('listeningNotebook.delete')} variant="text" size="sm" onPress={() => void useListeningNotebookStore.getState().remove(owner, moment.id)} testID={`notebook-delete-${moment.id}`} />
                        </View>
                      </>
                    )}
                    {notice?.id === moment.id ? (
                      <Text style={styles.warn} testID={`notebook-notice-${moment.id}`}>
                        {t(notice.kind === 'missing' ? 'listeningNotebook.trackMissing' : 'listeningNotebook.notSeekable')}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
      <Text style={styles.meta}>{t('listeningNotebook.storageNote')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  title: { ...typography.h2, color: colors.textPrimary },
  group: { gap: spacing.xs },
  trackTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  moment: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  time: { minWidth: 56, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.surfaceAlt },
  timeText: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.primary },
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  card: { gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  error: { gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.compact, borderLeftWidth: 4, borderLeftColor: colors.accentTerracotta, backgroundColor: colors.surfaceElevated },
  label: { ...textStyles.overline, color: colors.accentBrownDark },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
});
