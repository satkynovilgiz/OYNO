import { router } from 'expo-router';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { AnimatedPressable, Button, IconButton, TextField } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { announce } from '@/services/a11y/announce';
import { handOffToCreator } from '@/services/culture/oymoHandoff';
import { ownerMotifs, useCustomMotifsStore } from '@/store/useCustomMotifsStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { GeometryShape } from '../components/LayerMotif';
import { CUSTOM_PREFIX, current, edit, embed, GRID, MAX_PRIMITIVES, NAME_MAX, newMotif, POLYGON_MAX, POLYGON_MIN, redo, snap, startHistory, toGeometry, undo, type CustomMotif, type CustomPrimitive, type History } from './customMotifModel';

const CELL = 12;
const SIZE = GRID * CELL;
type Tool = 'line' | 'circle' | 'polygon';
const TOOLS: Tool[] = ['line', 'circle', 'polygon'];

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

/** "Line from (2, 3) to (10, 3)" - the list alternative to the grid. */
export function describePrimitive(p: CustomPrimitive, t: (key: string, o?: Record<string, unknown>) => string): string {
  if (p.kind === 'line') return t('customMotif.describe.line', { x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2 });
  if (p.kind === 'circle') return t('customMotif.describe.circle', { cx: p.cx, cy: p.cy, r: p.r });
  return t('customMotif.describe.polygon', { count: p.points.length, points: p.points.map(([x, y]) => `(${x}, ${y})`).join(' ') });
}

/* ---------- /culture/oymo/motifs ---------- */

/** Unsaved editing sessions per owner + motif (memory) - kept while you look elsewhere. */
const sessions = new Map<string, History>();

export function CustomMotifListScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const owner = useRecordsOwner();
  const status = useCustomMotifsStore((s) => s.status);
  const saved = useCustomMotifsStore((s) => s.saved);
  const motifs = ownerMotifs(saved, owner);
  useEffect(() => {
    void useCustomMotifsStore.getState().load();
  }, []);
  return (
    <View style={styles.root}>
      <Header title={t('customMotif.title')} onPressBack={onPressBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="custom-motifs">
        <Text style={styles.body}>{t('customMotif.intro')}</Text>
        <Text style={styles.note}>{t('customMotif.userCreatedNote')}</Text>
        {status === 'error' ? (
          <View style={styles.stack}>
            <Text style={styles.warn}>{t('customMotif.loadError')}</Text>
            <Button label={t('common.retry')} onPress={() => void useCustomMotifsStore.getState().retryLoad()} />
          </View>
        ) : null}
        <Button label={t('customMotif.new')} disabled={status !== 'ready'} onPress={() => router.push('/culture/oymo/motifs/new' as never)} testID="custom-motif-new" />
        {motifs.map((motif) => (
          <AnimatedPressable key={motif.id} style={styles.card} onPress={() => router.push(`/culture/oymo/motifs/${motif.id}` as never)} accessibilityRole="button" accessibilityLabel={`${motif.name || t('customMotif.untitled')}. ${t('customMotif.userCreated')}`} testID={`custom-motif-${motif.id}`}>
            <View style={styles.row}>
              <GeometryShape primitives={toGeometry(motif.primitives)} size={40} color={colors.textPrimary} />
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{motif.name || t('customMotif.untitled')}</Text>
                <Text style={styles.meta}>{t('customMotif.userCreated')} · {t('customMotif.parts', { count: motif.primitives.length })}</Text>
              </View>
              <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
            </View>
          </AnimatedPressable>
        ))}
      </ScrollView>
    </View>
  );
}

/* ---------- /culture/oymo/motifs/[motifId] ---------- */

export function CustomMotifEditorScreen({ motifId, onPressBack }: { motifId: string; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const owner = useRecordsOwner();
  const status = useCustomMotifsStore((s) => s.status);
  const saved = useCustomMotifsStore((s) => s.saved);
  const stored = useMemo(() => (motifId === 'new' ? null : (ownerMotifs(saved, owner).find((m) => m.id === motifId) ?? null)), [saved, owner, motifId]);
  const [history, setHistoryState] = useState<History | null>(null);
  const [tool, setTool] = useState<Tool>('line');
  const [pending, setPendingState] = useState<[number, number][]>([]);
  // Taps can arrive faster than re-renders: the points live in a ref, the state only mirrors them.
  const pendingRef = useRef<[number, number][]>([]);
  const setPending = (points: [number, number][]) => {
    pendingRef.current = points;
    setPendingState(points);
  };
  const historyRef = useRef<History | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const grid = useRef<View>(null);
  const sessionKey = `${owner}\u0000${motifId}`;
  useEffect(() => {
    void useCustomMotifsStore.getState().load();
  }, []);
  // Start (or resume) this owner's session once the store has loaded.
  useEffect(() => {
    if (status !== 'ready') return;
    const start = sessions.get(sessionKey) ?? (motifId === 'new' ? startHistory(newMotif()) : stored ? startHistory(stored) : null);
    historyRef.current = start;
    setHistoryState(start);
    setPending([]);
    setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, sessionKey]);
  const setHistory = (next: History) => {
    historyRef.current = next;
    sessions.set(sessionKey, next);
    setHistoryState(next);
    setSaveState('idle');
  };

  if (status !== 'ready' || !history) {
    return (
      <View style={styles.root}>
        <Header title={t('customMotif.editTitle')} onPressBack={onPressBack} />
        <View style={styles.content}>{status === 'ready' ? <Text style={styles.body} testID="custom-motif-not-found">{t('customMotif.notFound')}</Text> : <Text style={styles.meta}>{status === 'error' ? t('customMotif.loadError') : t('customMotif.loading')}</Text>}</View>
      </View>
    );
  }
  const motif: CustomMotif = current(history);
  const full = motif.primitives.length >= MAX_PRIMITIVES;
  const isFull = () => current(historyRef.current ?? history).primitives.length >= MAX_PRIMITIVES;
  const apply = (action: Parameters<typeof edit>[1]) => {
    const latest = historyRef.current ?? history;
    const next = edit(latest, action);
    if (next === latest) {
      announce(t('customMotif.notAllowed'));
      return false;
    }
    setHistory(next);
    return true;
  };
  const tap = (x: number, y: number) => {
    if (isFull()) return;
    const point: [number, number] = [snap(x), snap(y)];
    const points = [...pendingRef.current, point];
    if (tool === 'line' && points.length === 2) {
      if (apply({ type: 'add', primitive: { kind: 'line', x1: points[0][0], y1: points[0][1], x2: points[1][0], y2: points[1][1] } })) announce(t('customMotif.added'));
      setPending([]);
    } else if (tool === 'circle' && points.length === 2) {
      const r = Math.max(1, Math.min(GRID / 2, Math.round(Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]))));
      if (apply({ type: 'add', primitive: { kind: 'circle', cx: points[0][0], cy: points[0][1], r } })) announce(t('customMotif.added'));
      setPending([]);
    } else if (tool === 'polygon' && points.length >= POLYGON_MAX) {
      closePolygon(points);
    } else setPending(points);
  };
  const closePolygon = (points = pendingRef.current) => {
    if (points.length >= POLYGON_MIN && apply({ type: 'add', primitive: { kind: 'polygon', points } })) announce(t('customMotif.added'));
    setPending([]);
  };
  const press = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    grid.current?.measureInWindow((gx, gy) => tap((pageX - gx) / CELL, (pageY - gy) / CELL));
  };
  const save = async () => {
    const startedFor = owner;
    const sent = motif;
    setSaveState('saving');
    const ok = await useCustomMotifsStore.getState().save(startedFor, sent);
    if (startedFor !== owner) return;
    setSaveState(ok ? 'saved' : 'failed');
    announce(ok ? t('customMotif.savedAnnounce') : t('customMotif.saveFailed'));
    if (ok && sessions.get(sessionKey) && current(sessions.get(sessionKey)!) === sent) sessions.delete(sessionKey);
    if (ok && motifId === 'new') router.replace(`/culture/oymo/motifs/${sent.id}` as never);
  };
  const place = () => {
    // A new, unsaved design with this motif once, in the centre - the same embedded geometry the preview draws.
    const layer = { id: 'layer0', motifId: `${CUSTOM_PREFIX}${motif.id}`, color: colors.primary, point: { x: 150, y: 150 }, rotation: 0, scale: 1, visible: true, custom: embed(motif) };
    handOffToCreator({ layers: [layer], backgroundColor: '#EADCC0', nextId: 1 }, { symmetry: 'none', source: 'customMotif' });
    router.push('/culture/oymo/create' as never);
  };
  const geometry = toGeometry(motif.primitives);
  // What is on screen matches what's stored (so it's saved), not just "a save happened".
  const matchesStored = !!stored && stored.name === motif.name && JSON.stringify(stored.primitives) === JSON.stringify(motif.primitives);

  return (
    <View style={styles.root}>
      <Header title={motif.name || t('customMotif.editTitle')} onPressBack={onPressBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled" testID="custom-motif-editor">
        <Text style={styles.note}>{t('customMotif.userCreatedNote')}</Text>
        <TextField label={t('customMotif.name')} value={motif.name} onChangeText={(name) => apply({ type: 'rename', name: name.slice(0, NAME_MAX) })} placeholder={t('customMotif.namePlaceholder')} testID="custom-motif-name" />

        <Text style={styles.section}>{t('customMotif.toolTitle')}</Text>
        <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={t('customMotif.toolTitle')}>
          {TOOLS.map((option) => (
            <AnimatedPressable key={option} style={[styles.chip, tool === option && styles.chipOn]} onPress={() => { setTool(option); setPending([]); }} accessibilityRole="radio" accessibilityState={{ checked: tool === option }} aria-checked={tool === option} testID={`custom-motif-tool-${option}`}>
              <Text style={[styles.chipText, tool === option && styles.chipTextOn]}>{t(`customMotif.tools.${option}`)}</Text>
            </AnimatedPressable>
          ))}
        </View>
        <Text style={styles.meta}>{t(`customMotif.howTo.${tool}`)}</Text>

        <View ref={grid} style={styles.grid} accessibilityLabel={t('customMotif.gridLabel')} role="group">
          <Pressable onPress={press} style={StyleSheet.absoluteFill} accessibilityRole="none" testID="custom-motif-grid">
            <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${GRID} ${GRID}`}>
              <Rect width={GRID} height={GRID} fill={colors.surface} />
              {Array.from({ length: GRID / 2 + 1 }, (_, i) => i * 2).map((v) => (
                <Line key={`v${v}`} x1={v} y1={0} x2={v} y2={GRID} stroke={colors.borderSubtle} strokeWidth={0.06} />
              ))}
              {Array.from({ length: GRID / 2 + 1 }, (_, i) => i * 2).map((v) => (
                <Line key={`h${v}`} x1={0} y1={v} x2={GRID} y2={v} stroke={colors.borderSubtle} strokeWidth={0.06} />
              ))}
              {pending.map(([x, y], i) => (
                <Circle key={`p${i}`} cx={x} cy={y} r={0.5} fill={colors.accentTerracotta} />
              ))}
            </Svg>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <GeometryShape primitives={geometry} size={SIZE} color={colors.textPrimary} />
            </View>
          </Pressable>
        </View>
        {pending.length ? <Text style={styles.meta} testID="custom-motif-pending">{t('customMotif.pending', { count: pending.length })}</Text> : null}
        {tool === 'polygon' ? <Button label={t('customMotif.closeShape')} variant="secondary" size="sm" disabled={pending.length < POLYGON_MIN} onPress={() => closePolygon()} testID="custom-motif-close" /> : null}
        {full ? <Text style={styles.warn}>{t('customMotif.full', { max: MAX_PRIMITIVES })}</Text> : null}

        <View style={styles.wrap}>
          <Button label={t('customMotif.undo')} variant="secondary" size="sm" disabled={history.index === 0} onPress={() => setHistory(undo(history))} testID="custom-motif-undo" />
          <Button label={t('customMotif.redo')} variant="secondary" size="sm" disabled={history.index >= history.stack.length - 1} onPress={() => setHistory(redo(history))} testID="custom-motif-redo" />
        </View>

        <Text style={styles.section} accessibilityRole="header">
          {t('customMotif.partsTitle', { count: motif.primitives.length, max: MAX_PRIMITIVES })}
        </Text>
        {motif.primitives.length === 0 ? <Text style={styles.meta}>{t('customMotif.noParts')}</Text> : null}
        {motif.primitives.map((p, index) => (
          <View key={index} style={[styles.part, selected === index && styles.partOn]} testID={`custom-motif-part-${index}`}>
            <AnimatedPressable onPress={() => setSelected(selected === index ? null : index)} accessibilityRole="button" accessibilityState={{ selected: selected === index }} style={styles.flex}>
              <Text style={styles.body}>
                {index + 1}. {describePrimitive(p, t)}
              </Text>
            </AnimatedPressable>
            {selected === index ? (
              <View style={styles.wrap}>
                {([['left', -1, 0, ArrowLeft], ['up', 0, -1, ArrowUp], ['down', 0, 1, ArrowDown], ['right', 1, 0, ArrowRight]] as const).map(([dir, dx, dy, Icon]) => (
                  <IconButton key={dir} icon={Icon} size={40} accessibilityLabel={t(`customMotif.move.${dir}`, { n: index + 1 })} onPress={() => apply({ type: 'move', index, dx, dy })} testID={`custom-motif-move-${dir}-${index}`} />
                ))}
                <Button label={t('customMotif.remove')} variant="text" size="sm" onPress={() => { apply({ type: 'remove', index }); setSelected(null); }} testID={`custom-motif-remove-${index}`} />
              </View>
            ) : null}
          </View>
        ))}

        <Text style={styles.section} accessibilityRole="header">
          {t('customMotif.previewTitle')}
        </Text>
        <View style={styles.row} testID="custom-motif-preview" accessible accessibilityRole="image" accessibilityLabel={t('customMotif.previewA11y', { count: motif.primitives.length })}>
          {[20, 36, 72].map((size) => (
            <View key={size} style={styles.previewCell}>
              <GeometryShape primitives={geometry} size={size} color={colors.primary} />
              <Text style={styles.meta}>{size} pt</Text>
            </View>
          ))}
        </View>

        <Button label={saveState === 'failed' ? t('common.retry') : t('customMotif.save')} loading={saveState === 'saving'} disabled={motif.primitives.length === 0} onPress={save} testID="custom-motif-save" />
        {saveState === 'saved' || (saveState !== 'failed' && matchesStored) ? <Text style={styles.meta} accessibilityLiveRegion="polite" testID="custom-motif-saved">{t('customMotif.savedAnnounce')}</Text> : null}
        {saveState === 'failed' ? <Text style={styles.warn} accessibilityLiveRegion="polite" testID="custom-motif-save-failed">{t('customMotif.saveFailed')}</Text> : null}
        <Button label={t('customMotif.place')} variant="secondary" disabled={motif.primitives.length === 0} onPress={place} testID="custom-motif-place" />
        <Text style={styles.meta}>{t('customMotif.storageNote')}</Text>
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
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  grid: { width: SIZE, height: SIZE, alignSelf: 'center', borderWidth: 1, borderColor: colors.borderSubtle },
  part: { gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.compact, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surfaceElevated },
  partOn: { borderColor: colors.primary, borderWidth: 2 },
  previewCell: { alignItems: 'center', gap: 4, minWidth: 80 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  chipTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
});
