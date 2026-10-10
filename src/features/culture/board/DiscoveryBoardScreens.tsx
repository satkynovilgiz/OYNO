import { router } from 'expo-router';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Quote, StickyNote, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotFoundState } from '@/components/system/NotFoundState';
import { AnimatedPressable, Button, IconButton, TextField } from '@/components/ui';
import { connectionRoute, contentRoute, SOURCE_FIELD_LABEL, type ConnectionContentType } from '@/features/culture/connections/connectionsData';
import { useConnectionContent } from '@/features/culture/connections/useConnectionContent';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { announce } from '@/services/a11y/announce';
import { ownerBoard, ownerBoards, useDiscoveryBoardStore } from '@/store/useDiscoveryBoardStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { addCard, addObservation, attachConnection, availableConnections, cardKey, connectedSuggestions, createBoard, MAX_CARDS, moveCard, NOTE_MAX, PROMPTS, QUESTION_MAX, removeCard, removeLink, rename, reviewBoard, setQuestion, TITLE_MAX, type Board, type PromptId, type ReviewLink } from './boardModel';

const boardRoute = (id: string) => `/culture/board/${encodeURIComponent(id)}`;

/** Unsent work on a board (mode, a half-written observation) - kept in memory while a source is open. */
type Draft = { mode: 'edit' | 'review'; note: string; noteCards: string[] };
const drafts = new Map<string, Draft>();
const draftKey = (owner: string, boardId: string) => `${owner}\u0000${boardId}`;

function useBoards() {
  const owner = useRecordsOwner();
  const saved = useDiscoveryBoardStore((state) => state.saved);
  const isLoaded = useDiscoveryBoardStore((state) => state.isLoaded);
  useEffect(() => {
    void useDiscoveryBoardStore.getState().load();
  }, []);
  return { owner, saved, isLoaded };
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

/** /culture/board?from=<type>:<id> - start a board around an article, or reopen one. */
export function BoardStartScreen({ from, onPressBack }: { from: string | null; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { owner, saved, isLoaded } = useBoards();
  const content = useConnectionContent();
  const [question, setQuestionText] = useState('');
  const [prompt, setPrompt] = useState<PromptId | null>(null);
  const [full, setFull] = useState(false);
  const [type, ...rest] = (from ?? '').split(':');
  const startRef = type === 'culture_item' || type === 'culture_material' ? { type: type as ConnectionContentType, id: rest.join(':') } : null;
  const start = startRef ? content.get(startRef.type, startRef.id) : null;
  const boards = ownerBoards(saved, owner);

  const create = () => {
    if (!startRef || !start) return;
    const text = prompt ? t(`discoveryBoard.prompts.${prompt}`) : question.trim();
    const board = createBoard({ ...startRef, titleSnapshot: start.title }, { question: text, promptId: prompt, title: start.title });
    if (!useDiscoveryBoardStore.getState().add(owner, board)) {
      setFull(true);
      return;
    }
    // Back from the new board returns to the article.
    router.replace(boardRoute(board.id) as never);
  };

  return (
    <View style={styles.root}>
      <Header title={t('discoveryBoard.title')} onPressBack={onPressBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.meta}>{t('discoveryBoard.intro')}</Text>
        {startRef ? (
          <View style={styles.card} testID="board-start">
            <Text style={styles.section}>{t('discoveryBoard.startFrom')}</Text>
            <Text style={styles.cardTitle}>{start?.title ?? (content.isLoading ? '…' : t('discoveryBoard.unavailable'))}</Text>
            <TextField testID="board-question" label={t('discoveryBoard.questionLabel')} value={prompt ? t(`discoveryBoard.prompts.${prompt}`) : question} onChangeText={(value) => { setPrompt(null); setQuestionText(value.slice(0, QUESTION_MAX)); }} placeholder={t('discoveryBoard.questionPlaceholder')} />
            <Text style={styles.meta}>{t('discoveryBoard.orPrompt')}</Text>
            <View style={styles.wrap}>
              {PROMPTS.map((id) => (
                <AnimatedPressable key={id} style={[styles.chip, prompt === id && styles.chipOn]} onPress={() => setPrompt(prompt === id ? null : id)} accessibilityRole="button" accessibilityState={{ selected: prompt === id }} testID={`board-prompt-${id}`}>
                  <Text style={[styles.chipText, prompt === id && styles.chipTextOn]}>{t(`discoveryBoard.prompts.${id}`)}</Text>
                </AnimatedPressable>
              ))}
            </View>
            <Button label={t('discoveryBoard.create')} onPress={create} disabled={!start || (!prompt && !question.trim())} testID="board-create" />
            {full ? <Text style={styles.warn}>{t('discoveryBoard.full')}</Text> : null}
          </View>
        ) : null}

        <Text style={styles.section} accessibilityRole="header">
          {t('discoveryBoard.yourBoards')}
        </Text>
        {!isLoaded ? <Text style={styles.meta}>…</Text> : boards.length === 0 ? <Text style={styles.meta}>{t('discoveryBoard.noBoards')}</Text> : null}
        {boards.map((board) => (
          <AnimatedPressable key={board.id} style={styles.listRow} onPress={() => router.push(boardRoute(board.id) as never)} accessibilityRole="button" accessibilityLabel={`${board.title}. ${board.question}`} testID={`board-open-${board.id}`}>
            <View style={styles.flex}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {board.title || t('discoveryBoard.untitled')}
              </Text>
              <Text style={styles.meta} numberOfLines={2}>
                {board.question}
              </Text>
              <Text style={styles.meta}>{t('discoveryBoard.cardCount', { count: board.cards.length })}</Text>
            </View>
            <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
          </AnimatedPressable>
        ))}
        <Text style={styles.meta}>{t('discoveryBoard.localNote')}</Text>
      </ScrollView>
    </View>
  );
}

/** /culture/board/[boardId] - edit and review one board. */
export function BoardScreen({ boardId, onPressBack }: { boardId: string; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { owner, saved, isLoaded } = useBoards();
  const content = useConnectionContent();
  const ready = !content.isLoading && !content.waitingForNetwork;
  const board = ownerBoard(saved, owner, boardId);
  const key = draftKey(owner, boardId);
  const [draft, setDraftState] = useState<Draft>(() => drafts.get(key) ?? { mode: 'edit', note: '', noteCards: [] });
  const setDraft = (patch: Partial<Draft>) =>
    setDraftState((current) => {
      const next = { ...current, ...patch };
      drafts.set(key, next);
      return next;
    });
  // Another account: never the previous one's draft.
  useEffect(() => {
    setDraftState(drafts.get(key) ?? { mode: 'edit', note: '', noteCards: [] });
  }, [key]);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Until the catalogue is ready every card counts as available (its remembered title is shown).
  const resolveTitle = useMemo(() => (type: ConnectionContentType, id: string) => (ready ? (content.get(type, id)?.title ?? null) : (board?.cards.find((card) => card.type === type && card.id === id)?.titleSnapshot ?? id)), [ready, content, board]);
  const review = useMemo(() => (board ? reviewBoard(board, resolveTitle) : null), [board, resolveTitle]);

  if (!isLoaded) return <View style={styles.root} />;
  if (!board || !review) return <NotFoundState onPressBack={onPressBack} />;

  const update = (change: (current: Board) => Board) => useDiscoveryBoardStore.getState().update(owner, board.id, change);
  const sectionLabel = (field: string) => (SOURCE_FIELD_LABEL[field] ? t(SOURCE_FIELD_LABEL[field]) : field);
  const relation = (link: Extract<ReviewLink, { kind: 'sourced' }>) => t(`culture.connections.relation.${link.connection.relationKey}`);
  const attachable = availableConnections(board);
  const onBoard = new Set(board.cards.map(cardKey));
  const suggestions = connectedSuggestions(board).filter((ref) => ready && content.get(ref.type, ref.id));
  const query = search.trim().toLowerCase();
  // Search over the SAME localized article list the app already uses.
  const results = query.length >= 2 ? content.all().filter((target) => !onBoard.has(`${target.type}:${target.id}`) && target.title.toLowerCase().includes(query)).slice(0, 8) : [];
  const full = board.cards.length >= MAX_CARDS;
  const add = (type: ConnectionContentType, id: string) => {
    const target = content.get(type, id);
    if (!target) return;
    update((current) => addCard(current, { type, id, titleSnapshot: target.title }));
    setSearch('');
    announce(t('discoveryBoard.added', { name: target.title }));
  };

  const linkView = (link: ReviewLink, editable: boolean) => {
    if (link.kind === 'observation')
      return (
        <View key={link.id} style={[styles.link, styles.observation]} testID={`board-observation-${link.id}`}>
          <View style={styles.inline}>
            <StickyNote size={14} color={colors.accentBrownDark} strokeWidth={2} />
            <Text style={styles.observationLabel}>{t('discoveryBoard.observationLabel')}</Text>
          </View>
          {link.about.length ? <Text style={styles.meta}>{t('discoveryBoard.about', { names: link.about.join(' · ') })}</Text> : null}
          <Text style={styles.body}>{link.text}</Text>
          <Text style={styles.meta}>{t('discoveryBoard.observationNote')}</Text>
          {editable ? <Button label={t('discoveryBoard.removeLink')} variant="text" size="sm" onPress={() => update((current) => removeLink(current, link.id))} testID={`board-remove-link-${link.id}`} /> : null}
        </View>
      );
    if (link.kind === 'missingConnection')
      return (
        <View key={link.id} style={styles.link} testID={`board-missing-connection-${link.id}`}>
          <Text style={styles.body}>{t('discoveryBoard.connectionGone')}</Text>
          {editable ? <Button label={t('discoveryBoard.removeLink')} variant="text" size="sm" onPress={() => update((current) => removeLink(current, link.id))} /> : null}
        </View>
      );
    return (
      <View key={link.id} style={[styles.link, styles.sourced]} testID={`board-sourced-${link.connection.id}`}>
        <View style={styles.inline}>
          <Quote size={14} color={colors.primary} strokeWidth={2} />
          <Text style={styles.sourcedLabel}>{t('discoveryBoard.sourcedLabel')}</Text>
        </View>
        <Text style={styles.cardTitle}>
          {link.fromTitle} → {relation(link)} → {link.toTitle}
        </Text>
        <Text style={styles.quote}>“{link.connection.evidence}”</Text>
        <Text style={styles.meta} testID={`board-evidence-source-${link.connection.id}`}>
          {t('culture.connections.fromArticle', { title: link.sourceTitle, section: sectionLabel(link.field) })}
          {link.sourceAvailable ? '' : ` · ${t('discoveryBoard.sourceUnavailable')}`}
        </Text>
        <View style={styles.wrap}>
          <Button label={t('discoveryBoard.openConnection')} variant="text" size="sm" onPress={() => router.push(connectionRoute(link.connection.id) as never)} testID={`board-open-connection-${link.connection.id}`} />
          {link.sourceAvailable ? <Button label={t('discoveryBoard.openSource')} variant="text" size="sm" onPress={() => router.push(contentRoute(link.connection.source.contentType, link.connection.source.contentId) as never)} testID={`board-open-source-${link.connection.id}`} /> : null}
          {editable ? <Button label={t('discoveryBoard.removeLink')} variant="text" size="sm" onPress={() => update((current) => removeLink(current, link.id))} testID={`board-remove-link-${link.id}`} /> : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <Header title={board.title || t('discoveryBoard.untitled')} onPressBack={onPressBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <View style={styles.wrap} accessibilityRole="tablist">
          {(['edit', 'review'] as const).map((mode) => (
            <AnimatedPressable key={mode} style={[styles.chip, draft.mode === mode && styles.chipOn]} onPress={() => setDraft({ mode })} accessibilityRole="tab" accessibilityState={{ selected: draft.mode === mode }} testID={`board-mode-${mode}`}>
              <Text style={[styles.chipText, draft.mode === mode && styles.chipTextOn]}>{t(`discoveryBoard.mode.${mode}`)}</Text>
            </AnimatedPressable>
          ))}
        </View>

        {draft.mode === 'review' ? (
          <View style={styles.stack} testID="board-review">
            <Text style={styles.section}>{t('discoveryBoard.question')}</Text>
            <Text style={styles.questionText}>{board.question || t('discoveryBoard.noQuestion')}</Text>
            <Text style={styles.section} accessibilityRole="header">
              {t('discoveryBoard.cardsTitle', { count: board.cards.length, max: MAX_CARDS })}
            </Text>
            {review.cards.map((card) => (
              <View key={card.key} style={styles.listRow} testID={`board-review-card-${card.position}`}>
                <Text style={[styles.body, styles.flex]}>
                  {card.position + 1}. {card.title}
                  {card.available ? '' : ` · ${t('discoveryBoard.unavailable')}`}
                </Text>
                {card.available ? <Button label={t('discoveryBoard.openArticle')} variant="text" size="sm" onPress={() => router.push(contentRoute(card.type, card.id) as never)} testID={`board-review-open-${card.position}`} /> : null}
              </View>
            ))}
            <Text style={styles.section} accessibilityRole="header">
              {t('discoveryBoard.linksTitle')}
            </Text>
            {review.links.length === 0 ? <Text style={styles.meta}>{t('discoveryBoard.noLinks')}</Text> : review.links.map((link) => linkView(link, false))}
          </View>
        ) : (
          <View style={styles.stack} testID="board-edit">
            <TextField testID="board-title" label={t('discoveryBoard.titleLabel')} value={board.title} onChangeText={(value) => update((current) => rename(current, value.slice(0, TITLE_MAX)))} />
            <TextField testID="board-question-edit" label={t('discoveryBoard.questionLabel')} value={board.question} onChangeText={(value) => update((current) => setQuestion(current, value.slice(0, QUESTION_MAX)))} />

            <Text style={styles.section} accessibilityRole="header">
              {t('discoveryBoard.cardsTitle', { count: board.cards.length, max: MAX_CARDS })}
            </Text>
            {review.cards.map((card, index) => (
              <View key={card.key} style={styles.cardRow} testID={`board-card-${index}`}>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {index + 1}. {card.title}
                  </Text>
                  {card.available ? null : (
                    <Text style={styles.warn} testID={`board-card-unavailable-${index}`}>
                      {t('discoveryBoard.cardUnavailable')}
                    </Text>
                  )}
                  <View style={styles.wrap}>
                    {card.available ? <Button label={t('discoveryBoard.openArticle')} variant="text" size="sm" onPress={() => router.push(contentRoute(card.type, card.id) as never)} testID={`board-card-open-${index}`} /> : null}
                    <Button label={t('discoveryBoard.removeCard')} variant="text" size="sm" onPress={() => update((current) => removeCard(current, card.key))} accessibilityHint={t('discoveryBoard.removeCardHint')} testID={`board-card-remove-${index}`} />
                  </View>
                </View>
                <View style={styles.moveColumn}>
                  <IconButton icon={ArrowUp} size={36} iconSize={14} elevated={false} disabled={index === 0} accessibilityLabel={t('discoveryBoard.moveUp', { name: card.title })} onPress={() => update((current) => moveCard(current, index, -1))} testID={`board-card-up-${index}`} />
                  <IconButton icon={ArrowDown} size={36} iconSize={14} elevated={false} disabled={index === board.cards.length - 1} accessibilityLabel={t('discoveryBoard.moveDown', { name: card.title })} onPress={() => update((current) => moveCard(current, index, 1))} testID={`board-card-down-${index}`} />
                </View>
              </View>
            ))}

            {full ? (
              <Text style={styles.meta}>{t('discoveryBoard.cardLimit', { max: MAX_CARDS })}</Text>
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('discoveryBoard.addCard')}</Text>
                {suggestions.length ? <Text style={styles.meta}>{t('discoveryBoard.suggestionsNote')}</Text> : null}
                <View style={styles.wrap}>
                  {suggestions.map((ref) => (
                    <AnimatedPressable key={cardKey(ref)} style={styles.chip} onPress={() => add(ref.type, ref.id)} accessibilityRole="button" accessibilityLabel={t('discoveryBoard.addNamed', { name: content.get(ref.type, ref.id)?.title ?? '' })} testID={`board-suggest-${ref.id}`}>
                      <Text style={styles.chipText}>+ {content.get(ref.type, ref.id)?.title}</Text>
                    </AnimatedPressable>
                  ))}
                </View>
                <TextField testID="board-search" label={t('discoveryBoard.search')} value={search} onChangeText={setSearch} placeholder={t('discoveryBoard.searchPlaceholder')} />
                {results.map((target) => (
                  <AnimatedPressable key={`${target.type}:${target.id}`} style={styles.listRow} onPress={() => add(target.type, target.id)} accessibilityRole="button" accessibilityLabel={t('discoveryBoard.addNamed', { name: target.title })} testID={`board-result-${target.id}`}>
                    <Text style={[styles.body, styles.flex]}>+ {target.title}</Text>
                  </AnimatedPressable>
                ))}
              </View>
            )}

            <Text style={styles.section} accessibilityRole="header">
              {t('discoveryBoard.linksTitle')}
            </Text>
            {review.links.map((link) => linkView(link, true))}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('discoveryBoard.attachSourced')}</Text>
              <Text style={styles.meta}>{t('discoveryBoard.attachSourcedNote')}</Text>
              {attachable.length === 0 ? <Text style={styles.meta}>{t('discoveryBoard.noneToAttach')}</Text> : null}
              {attachable.map((connection) => (
                <View key={connection.id} style={styles.link}>
                  <Text style={styles.body}>
                    {resolveTitle(connection.fromType, connection.fromId) ?? connection.fromId} → {t(`culture.connections.relation.${connection.relationKey}`)} → {resolveTitle(connection.toType, connection.toId) ?? connection.toId}
                  </Text>
                  <Text style={styles.quote}>“{connection.evidence}”</Text>
                  <Button label={t('discoveryBoard.attach')} variant="secondary" size="sm" onPress={() => { update((current) => attachConnection(current, connection.id)); announce(t('discoveryBoard.attached')); }} testID={`board-attach-${connection.id}`} />
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('discoveryBoard.addObservation')}</Text>
              <Text style={styles.meta}>{t('discoveryBoard.observationNote')}</Text>
              <TextInput
                value={draft.note}
                onChangeText={(value) => setDraft({ note: value.slice(0, NOTE_MAX) })}
                multiline
                placeholder={t('discoveryBoard.observationPlaceholder')}
                placeholderTextColor={colors.textMuted}
                accessibilityLabel={t('discoveryBoard.addObservation')}
                style={styles.input}
                testID="board-note"
              />
              <Text style={styles.meta}>{t('discoveryBoard.aboutPick')}</Text>
              <View style={styles.wrap}>
                {review.cards.map((card) => {
                  const on = draft.noteCards.includes(card.key);
                  const blocked = !on && draft.noteCards.length >= 2;
                  return (
                    <AnimatedPressable key={card.key} style={[styles.chip, on && styles.chipOn]} disabled={blocked} onPress={() => setDraft({ noteCards: on ? draft.noteCards.filter((entry) => entry !== card.key) : [...draft.noteCards, card.key] })} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: blocked }} testID={`board-note-card-${card.position}`}>
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{card.title}</Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
              <Button label={t('discoveryBoard.saveObservation')} variant="secondary" disabled={!draft.note.trim()} onPress={() => { update((current) => addObservation(current, draft.note, draft.noteCards)); setDraft({ note: '', noteCards: [] }); announce(t('discoveryBoard.observationSaved')); }} testID="board-note-save" />
            </View>

            {confirmDelete ? (
              <View style={styles.card} testID="board-delete-confirm">
                <Text style={styles.body}>{t('discoveryBoard.deleteConfirm')}</Text>
                <View style={styles.wrap}>
                  <Button label={t('discoveryBoard.deleteYes')} variant="danger" onPress={() => { useDiscoveryBoardStore.getState().remove(owner, board.id); drafts.delete(key); onPressBack(); }} testID="board-delete-yes" />
                  <Button label={t('discoveryBoard.deleteNo')} variant="text" onPress={() => setConfirmDelete(false)} />
                </View>
              </View>
            ) : (
              <Button label={t('discoveryBoard.delete')} icon={<Trash2 size={16} color={colors.primary} strokeWidth={2} />} variant="secondary" onPress={() => setConfirmDelete(true)} testID="board-delete" />
            )}
            <Text style={styles.meta}>{t('discoveryBoard.localNote')}</Text>
          </View>
        )}
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
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.sm },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, color: colors.accentTerracottaText, fontWeight: '700' },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  questionText: { ...typography.h2, color: colors.textPrimary },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardRow: { flexDirection: 'row', gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  moveColumn: { gap: spacing.xs },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: 12, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.small, color: colors.textPrimary },
  chipTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
  link: { gap: 4, padding: spacing.sm, borderRadius: cardRadii.compact, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  sourced: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  observation: { borderLeftWidth: 3, borderLeftColor: colors.accentBrown, borderStyle: 'dashed', backgroundColor: colors.surfaceAlt },
  sourcedLabel: { ...textStyles.overline, color: colors.primary },
  observationLabel: { ...textStyles.overline, color: colors.accentBrownDark },
  quote: { ...textStyles.body, fontStyle: 'italic', color: colors.textPrimary },
  input: { ...textStyles.body, minHeight: 88, padding: spacing.sm, borderRadius: cardRadii.compact, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary, textAlignVertical: 'top' },
});
