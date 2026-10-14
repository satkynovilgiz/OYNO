import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, HelpCircle, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton, TextField } from '@/components/ui';
import { renderedSectionKeys, sectionLabelKey } from '@/features/culture/itemSections';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { announce } from '@/services/a11y/announce';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { TagPicker } from '@/features/tags/TagScreens';
import { ownerQuestions, useQuestionsStore } from '@/store/useQuestionsStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { ANSWER_MAX, byStatus, clearDraftIfUnchanged, getDraft, isValidQuestion, MAX_SUPPORTS, newQuestionId, QUESTION_MAX, questionRoute, resolveOrigin, setDraft, type ArticleLookup, type Question, type QuestionStatus } from './questionsModel';
import { LoadingState, StateMessage } from '@/components/state/ScreenState';

function useQuestions() {
  const owner = useRecordsOwner();
  const status = useQuestionsStore((state) => state.status);
  const raw = useQuestionsStore((state) => state.saved[owner]);
  const questions = useMemo(() => ownerQuestions({ [owner]: raw } as never, owner), [owner, raw]);
  useEffect(() => {
    void useQuestionsStore.getState().load();
  }, []);
  return { owner, status, questions };
}

/** Live article lookup from the cached article list: undefined while loading, null when gone. */
function useArticleLookup(): { lookup: ArticleLookup; items: ReturnType<typeof useAllCultureItems> } {
  const items = useAllCultureItems();
  const map = useMemo(() => new Map((items.data ?? []).map((item) => [item.id, { title: item.title, sections: renderedSectionKeys(item) }])), [items.data]);
  return { items, lookup: (id) => (items.data ? (map.get(id) ?? null) : items.isError ? null : undefined) };
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

function LoadState({ status }: { status: string }) {
  const { t } = useTranslation();
  if (status === 'error') return <StateMessage kind="error" title={t('myQuestions.loadError')} body={t('states.recordsErrorBody')} action={{ label: t('common.retry'), onPress: () => void useQuestionsStore.getState().retryLoad(), testID: 'questions-retry' }} testID="questions-load-error" />;
  return <LoadingState label={t('myQuestions.loading')} onRetry={() => void useQuestionsStore.getState().retryLoad()} />;
}

/* ---------- under an article section ---------- */

/** "Save a question" under one article section. The draft survives leaving the article (memory, per owner). */
export function SaveQuestion({ articleId, articleTitle, sectionKey, sectionLabel }: { articleId: string; articleTitle: string; sectionKey: string; sectionLabel: string }) {
  const { t } = useTranslation();
  const owner = useRecordsOwner();
  const status = useQuestionsStore((state) => state.status);
  const scope = `origin:${articleId}:${sectionKey}`;
  const [open, setOpen] = useState(() => getDraft(owner, scope) !== undefined);
  const [text, setText] = useState(() => getDraft(owner, scope) ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const shownOwner = useRef(owner);
  useEffect(() => {
    void useQuestionsStore.getState().load();
  }, []);
  useEffect(() => {
    if (shownOwner.current === owner) return;
    shownOwner.current = owner;
    setOpen(getDraft(owner, scope) !== undefined);
    setText(getDraft(owner, scope) ?? '');
    setFailed(false);
    setSavedId(null);
  }, [owner, scope]);
  const edit = (value: string) => {
    const next = value.slice(0, QUESTION_MAX);
    setText(next);
    setDraft(owner, scope, next);
  };
  const save = async () => {
    const startedFor = owner;
    const sent = text;
    setBusy(true);
    const id = await useQuestionsStore.getState().create(startedFor, newQuestionId(), sent, { articleId, sectionKey, articleTitle, sectionLabel });
    setBusy(false);
    if (shownOwner.current !== startedFor) return;
    if (!id) {
      setFailed(true); // the text stays here
      announce(t('myQuestions.saveFailed'));
      return;
    }
    setFailed(false);
    clearDraftIfUnchanged(startedFor, scope, sent);
    const left = getDraft(startedFor, scope);
    setText(left ?? '');
    setOpen(left !== undefined);
    setSavedId(id);
    announce(t('myQuestions.savedAnnounce'));
  };

  return (
    <View style={styles.inline}>
      {!open ? (
        <AnimatedPressable style={styles.inlineToggle} onPress={() => setOpen(true)} disabled={status !== 'ready'} accessibilityRole="button" accessibilityState={{ disabled: status !== 'ready' }} accessibilityLabel={t('myQuestions.saveA11y', { section: sectionLabel })} testID={`question-save-${sectionKey}`}>
          <HelpCircle size={14} color={colors.textSecondary} strokeWidth={2} />
          <Text style={styles.inlineText}>{t('myQuestions.save')}</Text>
        </AnimatedPressable>
      ) : (
        <View style={styles.stack} testID={`question-composer-${sectionKey}`}>
          <TextField label={t('myQuestions.yourQuestion')} value={text} onChangeText={edit} multiline placeholder={t('myQuestions.placeholder')} testID={`question-input-${sectionKey}`} />
          <Text style={styles.meta}>{t('myQuestions.ownWords')}</Text>
          <View style={styles.wrap}>
            <Button label={failed ? t('common.retry') : t('myQuestions.saveButton')} size="sm" loading={busy} disabled={!isValidQuestion(text)} onPress={save} testID={`question-submit-${sectionKey}`} />
            <Button
              label={t('common.cancel')}
              variant="text"
              size="sm"
              disabled={busy}
              onPress={() => {
                setDraft(owner, scope, null);
                setText('');
                setOpen(false);
                setFailed(false);
              }}
            />
          </View>
          {failed ? (
            <Text style={styles.warn} accessibilityLiveRegion="polite" testID="question-save-failed">
              {t('myQuestions.saveFailed')}
            </Text>
          ) : null}
        </View>
      )}
      {savedId ? (
        <AnimatedPressable style={styles.inlineToggle} onPress={() => router.push(questionRoute(savedId) as never)} accessibilityRole="link" testID="question-saved">
          <Text style={[styles.inlineText, styles.link]}>{t('myQuestions.savedLink')}</Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

/* ---------- /profile/questions ---------- */

export function QuestionsListScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { status, questions } = useQuestions();
  const [tab, setTab] = useState<QuestionStatus>('exploring');
  const list = byStatus(questions, tab);
  const counts = { exploring: byStatus(questions, 'exploring').length, answered: byStatus(questions, 'answered').length };
  return (
    <View style={styles.root}>
      <Header title={t('myQuestions.title')} onPressBack={onPressBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="questions-list">
        <Text style={styles.body}>{t('myQuestions.intro')}</Text>
        <Text style={styles.note}>{t('myQuestions.storageNote')}</Text>
        {status !== 'ready' ? (
          <LoadState status={status} />
        ) : (
          <>
            <View style={styles.wrap} accessibilityRole="tablist">
              {(['exploring', 'answered'] as const).map((option) => (
                <AnimatedPressable key={option} style={[styles.chip, tab === option && styles.chipOn]} onPress={() => setTab(option)} accessibilityRole="tab" accessibilityState={{ selected: tab === option }} aria-selected={tab === option} testID={`questions-tab-${option}`}>
                  <Text style={[styles.chipText, tab === option && styles.chipTextOn]}>{t(`myQuestions.tabs.${option}`, { count: counts[option] })}</Text>
                </AnimatedPressable>
              ))}
            </View>
            {list.length === 0 ? (
              <Text style={styles.meta} testID={`questions-empty-${tab}`}>
                {t(`myQuestions.empty.${tab}`)}
              </Text>
            ) : (
              <View style={styles.stack}>
                {list.map((question) => (
                  <AnimatedPressable key={question.id} style={styles.card} onPress={() => router.push(questionRoute(question.id) as never)} accessibilityRole="button" accessibilityLabel={`${question.text}. ${question.origin ? t('myQuestions.fromShort', { article: question.origin.articleTitle, section: question.origin.sectionLabel }) : ''}`} testID={`questions-item-${question.id}`}>
                    <View style={styles.row}>
                      <Text style={[styles.cardTitle, styles.flex]}>{question.text}</Text>
                      <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
                    </View>
                    {question.origin ? <Text style={styles.meta}>{t('myQuestions.fromShort', { article: question.origin.articleTitle, section: question.origin.sectionLabel })}</Text> : null}
                    <Text style={styles.meta}>{t('myQuestions.counts', { count: question.supports.length, answer: question.answer.trim() ? t('myQuestions.hasAnswer') : t('myQuestions.noAnswer') })}</Text>
                  </AnimatedPressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* ---------- /profile/questions/[questionId] ---------- */

export function QuestionDetailScreen({ questionId, onPressBack }: { questionId: string; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { owner, status, questions } = useQuestions();
  const { lookup, items } = useArticleLookup();
  const question: Question | null = questions[questionId] ?? null;
  const textScope = `text:${questionId}`;
  const answerScope = `answer:${questionId}`;
  const [text, setText] = useState<string | null>(() => getDraft(owner, textScope) ?? null);
  const [answer, setAnswer] = useState<string | null>(() => getDraft(owner, answerScope) ?? null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [query, setQuery] = useState('');
  const shownOwner = useRef(owner);
  useEffect(() => {
    if (shownOwner.current === owner) return;
    shownOwner.current = owner; // another account: none of the previous one's edits
    setText(getDraft(owner, textScope) ?? null);
    setAnswer(getDraft(owner, answerScope) ?? null);
    setFailed(false);
    setConfirmDelete(false);
  }, [owner, textScope, answerScope]);

  const shownText = text ?? question?.text ?? '';
  const shownAnswer = answer ?? question?.answer ?? '';
  const dirty = !!question && ((text !== null && text !== question.text) || (answer !== null && answer !== question.answer));
  const run = async (work: () => Promise<boolean>, announceKey: string) => {
    const startedFor = owner;
    setBusy(true);
    const ok = await work();
    setBusy(false);
    if (shownOwner.current !== startedFor) return false;
    setFailed(!ok);
    announce(t(ok ? announceKey : 'myQuestions.saveFailed'));
    return ok;
  };
  const saveEdits = async () => {
    if (!question || !isValidQuestion(shownText)) return;
    const sentText = text;
    const sentAnswer = answer;
    const startedFor = owner;
    const changes = [...(sentText !== null ? [{ type: 'text' as const, text: sentText }] : []), ...(sentAnswer !== null ? [{ type: 'answer' as const, answer: sentAnswer }] : [])];
    const ok = await run(() => useQuestionsStore.getState().change(startedFor, question.id, changes), 'myQuestions.editsSaved');
    if (!ok) return; // edits stay in the fields
    // Only what was sent is cleared - anything typed while saving stays.
    if (sentText !== null) clearDraftIfUnchanged(startedFor, textScope, sentText);
    if (sentAnswer !== null) clearDraftIfUnchanged(startedFor, answerScope, sentAnswer);
    setText(getDraft(startedFor, textScope) ?? null);
    setAnswer(getDraft(startedFor, answerScope) ?? null);
  };
  const editText = (value: string) => {
    const next = value.slice(0, QUESTION_MAX);
    setText(next);
    setDraft(owner, textScope, next);
  };
  const editAnswer = (value: string) => {
    const next = value.slice(0, ANSWER_MAX);
    setAnswer(next);
    setDraft(owner, answerScope, next);
  };

  let body: React.ReactNode;
  if (status !== 'ready') body = <LoadState status={status} />;
  else if (!question) {
    body = (
      <View style={styles.stack} testID="question-not-found">
        <Text style={styles.body}>{t('myQuestions.notFound')}</Text>
        <Button label={t('myQuestions.toList')} onPress={() => router.replace('/profile/questions' as never)} />
      </View>
    );
  } else {
    const origin = question.origin ? resolveOrigin(question.origin, lookup, (key) => (sectionLabelKey(key) ? t(sectionLabelKey(key)!) : null)) : null;
    const lower = query.trim().toLowerCase();
    const candidates = lower ? (items.data ?? []).filter((item) => item.title.toLowerCase().includes(lower) && !question.supports.some((s) => s.articleId === item.id)).slice(0, 6) : [];
    body = (
      <View style={styles.stack} testID="question-detail">
        <Text style={styles.status} testID="question-status">
          {question.status === 'answered' ? t('myQuestions.statusAnswered') : t('myQuestions.statusExploring')}
        </Text>
        <TextField label={t('myQuestions.yourQuestion')} value={shownText} onChangeText={editText} multiline testID="question-text" />
        <TagPicker recordRef={{ type: 'question', id: question.id }} />
        {!isValidQuestion(shownText) ? <Text style={styles.warn}>{t('myQuestions.emptyText')}</Text> : null}

        {origin ? (
          <View style={styles.card} testID="question-origin">
            <Text style={styles.label}>{t('myQuestions.askedWhile')}</Text>
            <Text style={styles.cardTitle}>
              {origin.title} - {origin.sectionLabel}
            </Text>
            {origin.state === 'live' ? <Button label={t('myQuestions.openSection')} variant="secondary" size="sm" onPress={() => router.push(origin.route as never)} testID="question-open-origin" /> : null}
            {origin.state === 'sectionMissing' ? (
              <>
                <Text style={styles.warn} testID="question-origin-section-missing">
                  {t('myQuestions.sectionMissing')}
                </Text>
                <Button label={t('myQuestions.openArticle')} variant="text" size="sm" onPress={() => router.push(origin.articleRoute as never)} />
              </>
            ) : null}
            {origin.state === 'articleMissing' ? (
              <Text style={styles.warn} testID="question-origin-missing">
                {t('myQuestions.articleMissing')}
              </Text>
            ) : null}
            {origin.state === 'loading' ? <Text style={styles.meta}>{t('myQuestions.loading')}</Text> : null}
          </View>
        ) : null}

        <Text style={styles.section} accessibilityRole="header">
          {t('myQuestions.supportsTitle')}
        </Text>
        <Text style={styles.meta}>{t('myQuestions.supportsNote')}</Text>
        {question.supports.length === 0 ? <Text style={styles.meta}>{t('myQuestions.noSupports')}</Text> : null}
        {question.supports.map((support) => {
          const live = lookup(support.articleId);
          return (
            <View key={support.articleId} style={styles.card} testID={`question-support-${support.articleId}`}>
              <Text style={styles.cardTitle}>{live ? live.title : support.title}</Text>
              {live === null ? <Text style={styles.warn}>{t('myQuestions.supportMissing')}</Text> : null}
              <View style={styles.wrap}>
                {live ? <Button label={t('myQuestions.open')} variant="secondary" size="sm" onPress={() => router.push(`/culture/item/${encodeURIComponent(support.articleId)}` as never)} testID={`question-support-open-${support.articleId}`} /> : null}
                <Button label={t('myQuestions.removeSupport')} variant="text" size="sm" disabled={busy} onPress={() => void run(() => useQuestionsStore.getState().change(owner, question.id, [{ type: 'removeSupport', articleId: support.articleId }]), 'myQuestions.supportRemoved')} testID={`question-support-remove-${support.articleId}`} />
              </View>
            </View>
          );
        })}
        {question.supports.length < MAX_SUPPORTS ? (
          <>
            <TextField label={t('myQuestions.findArticle')} value={query} onChangeText={setQuery} placeholder={t('myQuestions.findPlaceholder')} testID="question-support-search" />
            {candidates.map((item) => (
              <AnimatedPressable
                key={item.id}
                style={styles.pick}
                onPress={async () => {
                  if (await run(() => useQuestionsStore.getState().change(owner, question.id, [{ type: 'addSupport', support: { articleId: item.id, title: item.title } }]), 'myQuestions.supportAdded')) setQuery('');
                }}
                accessibilityRole="button"
                accessibilityLabel={t('myQuestions.addSupportA11y', { title: item.title })}
                testID={`question-support-add-${item.id}`}
              >
                <Text style={styles.body}>+ {item.title}</Text>
              </AnimatedPressable>
            ))}
          </>
        ) : (
          <Text style={styles.meta}>{t('myQuestions.supportsFull', { max: MAX_SUPPORTS })}</Text>
        )}

        <Text style={styles.section} accessibilityRole="header">
          {t('myQuestions.answerTitle')}
        </Text>
        <Text style={styles.meta}>{t('myQuestions.answerNote')}</Text>
        <TextField label={t('myQuestions.answerLabel')} value={shownAnswer} onChangeText={editAnswer} multiline placeholder={t('myQuestions.answerPlaceholder')} testID="question-answer" />

        <Button label={failed && dirty ? t('common.retry') : t('myQuestions.saveEdits')} loading={busy} disabled={!dirty || !isValidQuestion(shownText)} onPress={saveEdits} testID="question-save-edits" />
        {failed ? (
          <Text style={styles.warn} accessibilityLiveRegion="polite" testID="question-edit-failed">
            {t('myQuestions.saveFailed')}
          </Text>
        ) : null}

        {question.status === 'exploring' ? (
          <Button label={t('myQuestions.markAnswered')} variant="secondary" disabled={busy} onPress={() => void run(() => useQuestionsStore.getState().change(owner, question.id, [{ type: 'markAnswered' }]), 'myQuestions.markedAnswered')} testID="question-mark-answered" />
        ) : (
          <Button label={t('myQuestions.reopen')} variant="secondary" disabled={busy} onPress={() => void run(() => useQuestionsStore.getState().change(owner, question.id, [{ type: 'reopen' }]), 'myQuestions.reopened')} testID="question-reopen" />
        )}
        <Text style={styles.meta}>{t('myQuestions.answeredNote')}</Text>

        {confirmDelete ? (
          <View style={styles.card} testID="question-delete-confirm">
            <Text style={styles.body}>{t('myQuestions.deleteConfirm')}</Text>
            <View style={styles.wrap}>
              <Button
                label={t('myQuestions.deleteYes')}
                onPress={async () => {
                  const startedFor = owner;
                  if (await run(() => useQuestionsStore.getState().remove(startedFor, question.id), 'myQuestions.deleted')) {
                    setDraft(startedFor, textScope, null);
                    setDraft(startedFor, answerScope, null);
                    router.replace('/profile/questions' as never);
                  }
                }}
                testID="question-delete-yes"
              />
              <Button label={t('common.cancel')} variant="text" onPress={() => setConfirmDelete(false)} />
            </View>
          </View>
        ) : (
          <AnimatedPressable style={styles.inlineToggle} onPress={() => setConfirmDelete(true)} accessibilityRole="button" testID="question-delete">
            <Trash2 size={14} color={colors.accentTerracottaText} strokeWidth={2} />
            <Text style={[styles.inlineText, styles.danger]}>{t('myQuestions.delete')}</Text>
          </AnimatedPressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Header title={t('myQuestions.detailTitle')} onPressBack={onPressBack} />
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.sm },
  label: { ...textStyles.overline, color: colors.primary },
  status: { ...textStyles.small, fontWeight: '700', color: colors.primary },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  danger: { color: colors.accentTerracottaText },
  link: { color: colors.primary, fontWeight: '700' },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  pick: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: cardRadii.compact, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  inline: { gap: spacing.xs, marginTop: spacing.xs },
  inlineToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' },
  inlineText: { ...textStyles.small, color: colors.textSecondary },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  chipTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
});
