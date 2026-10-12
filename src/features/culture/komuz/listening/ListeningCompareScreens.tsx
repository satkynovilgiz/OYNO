import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton, TextField } from '@/components/ui';
import { komuzTracks, type KomuzTrack } from '@/features/culture/audioData';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { announce } from '@/services/a11y/announce';
import { ownerComparisons, useListeningCompareStore } from '@/store/useListeningCompareStore';
import { useListeningNotebookStore } from '@/store/useListeningNotebookStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { activeSide, canStart, clearNoteDraftIfUnchanged, compareRoute, COMPARE_NOTE_MAX, newComparisonId, noteDraft, rememberedPosition, rememberPosition, setNoteDraft, switchPlan, type Comparison, type Side } from './compareModel';
import { clockTime, realDuration, spokenTime } from './komuzQueue';
import { registerKomuzHost, useKomuzPlayerStore } from './useKomuzPlayerStore';

const trackById = (id: string): KomuzTrack | null => komuzTracks.find((entry) => entry.id === id) ?? null;
const available = (id: string) => !!trackById(id);

function useComparisons() {
  const owner = useRecordsOwner();
  const status = useListeningCompareStore((state) => state.status);
  const raw = useListeningCompareStore((state) => state.saved[owner]);
  const comparisons = useMemo(() => ownerComparisons({ [owner]: raw } as never, owner), [owner, raw]);
  useEffect(() => {
    void useListeningCompareStore.getState().load();
    void useListeningNotebookStore.getState().load();
  }, []);
  return { owner, status, comparisons };
}

function Header({ title, onPressBack }: { title: string; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}

/** Only metadata that exists and is confirmed: title (+ performer when confirmed), or the "unconfirmed" label. */
function TrackMeta({ trackId, fallbackTitle }: { trackId: string; fallbackTitle: string }) {
  const { t } = useTranslation();
  const entry = trackById(trackId);
  if (!entry) return <Text style={styles.cardTitle}>{fallbackTitle}</Text>;
  return (
    <View>
      <Text style={styles.cardTitle}>{entry.title}</Text>
      {entry.titleConfirmed && entry.performer ? <Text style={styles.meta}>{entry.performer}</Text> : null}
      {!entry.titleConfirmed ? <Text style={styles.meta}>{t('komuzRoom.titleUnconfirmed')}</Text> : null}
    </View>
  );
}

/* ---------- /culture/komuz/compare ---------- */

export function CompareStartScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { owner, status, comparisons } = useComparisons();
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const list = Object.values(comparisons).sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));

  const start = async () => {
    if (!a || !b || !canStart(a, b, available)) return;
    const id = newComparisonId();
    setBusy(true);
    const ok = await useListeningCompareStore.getState().create(owner, id, { trackId: a, title: trackById(a)!.title }, { trackId: b, title: trackById(b)!.title });
    setBusy(false);
    setFailed(!ok);
    if (ok) router.push(compareRoute(id) as never);
    else announce(t('listeningCompare.saveFailed'));
  };
  const picker = (side: Side, value: string | null, onChange: (id: string) => void, other: string | null) => (
    <View style={styles.stack} accessibilityRole="radiogroup" accessibilityLabel={t(`listeningCompare.choose.${side}`)}>
      <Text style={styles.section}>{t(`listeningCompare.choose.${side}`)}</Text>
      {komuzTracks.map((entry) => {
        const checked = value === entry.id;
        const disabled = other === entry.id;
        return (
          <AnimatedPressable key={entry.id} style={[styles.option, checked && styles.optionOn, disabled && styles.disabled]} disabled={disabled} onPress={() => onChange(entry.id)} accessibilityRole="radio" accessibilityState={{ checked, disabled }} aria-checked={checked} accessibilityLabel={`${entry.title}${entry.titleConfirmed ? '' : `. ${t('komuzRoom.titleUnconfirmed')}`}`} testID={`compare-pick-${side}-${entry.id}`}>
            <Text style={[styles.body, checked && styles.optionTextOn]}>{entry.title}</Text>
            {!entry.titleConfirmed ? <Text style={[styles.meta, checked && styles.optionTextOn]}>{t('komuzRoom.titleUnconfirmed')}</Text> : null}
          </AnimatedPressable>
        );
      })}
    </View>
  );

  return (
    <View style={styles.root}>
      <Header title={t('listeningCompare.title')} onPressBack={onPressBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="compare-start">
        <Text style={styles.body}>{t('listeningCompare.intro')}</Text>
        <Text style={styles.note}>{t('listeningCompare.noAlign')}</Text>
        {status === 'error' ? (
          <View style={styles.stack}>
            <Text style={styles.warn}>{t('listeningCompare.loadError')}</Text>
            <Button label={t('common.retry')} onPress={() => void useListeningCompareStore.getState().retryLoad()} />
          </View>
        ) : null}
        {list.length ? (
          <>
            <Text style={styles.section} accessibilityRole="header">
              {t('listeningCompare.saved')}
            </Text>
            {list.map((comparison) => (
              <AnimatedPressable key={comparison.id} style={styles.card} onPress={() => router.push(compareRoute(comparison.id) as never)} accessibilityRole="button" testID={`compare-open-${comparison.id}`}>
                <View style={styles.row}>
                  <Text style={[styles.cardTitle, styles.flex]}>
                    {comparison.a.title} · {comparison.b.title}
                  </Text>
                  <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
                </View>
                {comparison.note ? (
                  <Text style={styles.meta} numberOfLines={2}>
                    {comparison.note}
                  </Text>
                ) : null}
              </AnimatedPressable>
            ))}
          </>
        ) : null}
        {picker('a', a, setA, b)}
        {picker('b', b, setB, a)}
        <Button label={t('listeningCompare.start')} loading={busy} disabled={status !== 'ready' || !canStart(a, b, available)} onPress={start} testID="compare-begin" />
        {failed ? <Text style={styles.warn}>{t('listeningCompare.saveFailed')}</Text> : null}
      </ScrollView>
    </View>
  );
}

/* ---------- /culture/komuz/compare/[comparisonId] ---------- */

export function CompareScreen({ comparisonId, onPressBack }: { comparisonId: string; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { owner, status, comparisons } = useComparisons();
  const comparison: Comparison | null = comparisons[comparisonId] ?? null;
  const currentTrackId = useKomuzPlayerStore((state) => state.currentTrackId);
  const playing = useKomuzPlayerStore((state) => state.playing);
  const position = useKomuzPlayerStore((state) => state.position);
  const duration = realDuration(useKomuzPlayerStore((state) => state.duration));
  const [selected, setSelected] = useState<Side>('a');
  const [note, setNote] = useState<string | null>(() => noteDraft(owner, comparisonId) ?? null);
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteFailed, setNoteFailed] = useState(false);
  const [momentFailed, setMomentFailed] = useState<Side | null>(null);
  const [missing, setMissing] = useState<Side | null>(null);
  const shownOwner = useRef(owner);

  useEffect(() => registerKomuzHost(), []);
  useEffect(() => {
    if (shownOwner.current === owner) return;
    shownOwner.current = owner;
    setNote(noteDraft(owner, comparisonId) ?? null);
    setNoteFailed(false);
    setMomentFailed(null);
  }, [owner, comparisonId]);
  const side = comparison ? activeSide(comparison, currentTrackId) : null;
  // Keep each recording's own position while it is the one playing.
  useEffect(() => {
    if (comparison && side) rememberPosition(owner, comparison.id, side, position);
  }, [comparison, side, position, owner]);

  const switchTo = (to: Side) => {
    if (!comparison) return;
    setSelected(to);
    const player = useKomuzPlayerStore.getState();
    const plan = switchPlan(comparison, side, to, { currentTrackId: player.currentTrackId, position: player.position, duration: realDuration(player.duration) }, rememberedPosition(owner, comparison.id, to), available);
    if (plan.leave) rememberPosition(owner, comparison.id, plan.leave.side, plan.leave.seconds);
    setMissing(plan.start.kind === 'missing' ? to : null);
    if (plan.start.kind === 'playFrom') player.playFrom(plan.start.trackId, plan.start.seconds, [plan.start.trackId]); // loading B stops A (one player)
    if (plan.start.kind === 'already' && !player.playing) player.toggle();
    announce(t('listeningCompare.nowSide', { side: t(`listeningCompare.side.${to}`) }));
  };

  const saveMoment = async (which: Side) => {
    if (!comparison || side !== which) return;
    const startedFor = owner;
    const entry = comparison[which];
    const moment = await useListeningNotebookStore.getState().capture(startedFor, { trackId: entry.trackId, title: entry.title, position: useKomuzPlayerStore.getState().position, duration: realDuration(useKomuzPlayerStore.getState().duration) });
    const ok = !!moment && (await useListeningCompareStore.getState().saveMoment(startedFor, comparison.id, which, { momentId: moment.id, seconds: moment.seconds }));
    if (shownOwner.current !== startedFor) return;
    setMomentFailed(ok ? null : which);
    announce(ok ? t('listeningCompare.momentSaved', { side: t(`listeningCompare.side.${which}`), time: spokenTime(moment!.seconds, t) }) : t('listeningCompare.saveFailed'));
  };
  const goToMoment = (which: Side) => {
    if (!comparison) return;
    const saved = comparison.moments[which];
    const trackId = comparison[which].trackId;
    if (!saved) return;
    if (!available(trackId)) return setMissing(which);
    setSelected(which);
    const player = useKomuzPlayerStore.getState();
    if (player.currentTrackId === trackId && realDuration(player.duration) !== null) player.seek(saved.seconds);
    else {
      if (side && side !== which) rememberPosition(owner, comparison.id, side, player.position);
      player.playFrom(trackId, saved.seconds, [trackId]);
    }
    rememberPosition(owner, comparison.id, which, saved.seconds);
  };
  const saveNote = async () => {
    if (!comparison || note === null) return;
    const startedFor = owner;
    const sent = note;
    setNoteBusy(true);
    const ok = await useListeningCompareStore.getState().saveNote(startedFor, comparison.id, sent); // the player is not touched
    setNoteBusy(false);
    if (shownOwner.current !== startedFor) return;
    setNoteFailed(!ok);
    if (!ok) return announce(t('listeningCompare.saveFailed'));
    clearNoteDraftIfUnchanged(startedFor, comparison.id, sent);
    setNote(noteDraft(startedFor, comparison.id) ?? null);
    announce(t('listeningCompare.noteSaved'));
  };

  let body: React.ReactNode;
  if (status !== 'ready') body = <Text style={styles.meta}>{status === 'error' ? t('listeningCompare.loadError') : t('listeningCompare.loading')}</Text>;
  else if (!comparison) {
    body = (
      <View style={styles.stack} testID="compare-not-found">
        <Text style={styles.body}>{t('listeningCompare.notFound')}</Text>
        <Button label={t('listeningCompare.toStart')} onPress={() => router.replace('/culture/komuz/compare' as never)} />
      </View>
    );
  } else {
    const shownNote = note ?? comparison.note;
    body = (
      <View style={styles.stack} testID="compare-session">
        <Text style={styles.note}>{t('listeningCompare.oneAtATime')}</Text>
        <View style={styles.wrap} accessibilityRole="tablist">
          {(['a', 'b'] as const).map((which) => (
            <AnimatedPressable key={which} style={[styles.tab, selected === which && styles.tabOn]} onPress={() => switchTo(which)} accessibilityRole="tab" accessibilityState={{ selected: selected === which }} aria-selected={selected === which} accessibilityLabel={`${t(`listeningCompare.side.${which}`)}: ${comparison[which].title}`} testID={`compare-switch-${which}`}>
              <Text style={[styles.tabText, selected === which && styles.tabTextOn]}>{t(`listeningCompare.side.${which}`)}</Text>
            </AnimatedPressable>
          ))}
        </View>

        {(['a', 'b'] as const).map((which) => {
          const entry = comparison[which];
          const isActive = side === which;
          const saved = comparison.moments[which];
          const gone = !available(entry.trackId);
          return (
            <View key={which} style={[styles.card, isActive && styles.cardActive]} testID={`compare-side-${which}`}>
              <Text style={styles.label}>{t(`listeningCompare.side.${which}`)}</Text>
              <TrackMeta trackId={entry.trackId} fallbackTitle={entry.title} />
              {gone || missing === which ? (
                <Text style={styles.warn} testID={`compare-missing-${which}`}>
                  {t('listeningCompare.missing')}
                </Text>
              ) : null}
              {isActive ? (
                <>
                  <View style={styles.row}>
                    <IconButton icon={playing ? Pause : Play} shape="roundedSquare" accessibilityLabel={playing ? t('komuzRoom.pause') : t('komuzRoom.play')} onPress={() => useKomuzPlayerStore.getState().toggle()} testID={`compare-toggle-${which}`} />
                    <Text style={styles.meta} testID={`compare-time-${which}`} accessibilityLabel={duration !== null ? t('komuzRoom.timeOf', { elapsed: spokenTime(position, t), duration: spokenTime(duration, t) }) : undefined}>
                      {clockTime(position)}
                      {duration !== null ? ` / ${clockTime(duration)}` : ''}
                    </Text>
                  </View>
                  {duration === null ? <Text style={styles.meta}>{t('listeningCompare.notSeekable')}</Text> : null}
                  <Button label={t('listeningCompare.saveMoment', { time: clockTime(position) })} variant="secondary" size="sm" onPress={() => void saveMoment(which)} testID={`compare-save-moment-${which}`} />
                </>
              ) : (
                <Text style={styles.meta}>{t('listeningCompare.notPlaying', { time: clockTime(rememberedPosition(owner, comparison.id, which)) })}</Text>
              )}
              {momentFailed === which ? <Text style={styles.warn}>{t('listeningCompare.saveFailed')}</Text> : null}
              {saved ? (
                <View style={styles.row}>
                  <Text style={[styles.body, styles.flex]} testID={`compare-moment-${which}`}>
                    {t('listeningCompare.savedMoment', { time: clockTime(saved.seconds) })}
                  </Text>
                  {!gone ? <Button label={t('listeningCompare.goToMoment')} variant="text" size="sm" onPress={() => goToMoment(which)} testID={`compare-go-${which}`} /> : null}
                </View>
              ) : null}
            </View>
          );
        })}

        <Text style={styles.section} accessibilityRole="header">
          {t('listeningCompare.noteTitle')}
        </Text>
        <Text style={styles.meta}>{t('listeningCompare.noteHint')}</Text>
        <TextField
          label={t('listeningCompare.noteLabel')}
          value={shownNote}
          onChangeText={(value) => {
            const next = value.slice(0, COMPARE_NOTE_MAX);
            setNote(next);
            setNoteDraft(owner, comparison.id, next);
          }}
          multiline
          placeholder={t('listeningCompare.notePlaceholder')}
          testID="compare-note"
        />
        <Button label={noteFailed ? t('common.retry') : t('listeningCompare.saveNote')} loading={noteBusy} disabled={note === null || note === comparison.note} onPress={saveNote} testID="compare-save-note" />
        {noteFailed ? (
          <Text style={styles.warn} accessibilityLiveRegion="polite" testID="compare-note-failed">
            {t('listeningCompare.saveFailed')}
          </Text>
        ) : null}
        <Text style={styles.meta}>{t('listeningCompare.storageNote')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Header title={t('listeningCompare.title')} onPressBack={onPressBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        {body}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  stack: { gap: spacing.sm },
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.sm },
  label: { ...textStyles.overline, color: colors.primary },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardActive: { borderColor: colors.primary, borderWidth: 2 },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  option: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: cardRadii.compact, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  optionOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionTextOn: { color: colors.textOnPrimary },
  disabled: { opacity: 0.5 },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: cardRadii.compact, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  tabTextOn: { color: colors.textOnPrimary },
});
