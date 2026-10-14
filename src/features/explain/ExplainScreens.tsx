import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton, TextField } from '@/components/ui';
import { renderedSectionKeys, sectionLabelKey } from '@/features/culture/itemSections';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { announce } from '@/services/a11y/announce';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import type { CultureItemRow } from '@/services/content/types';
import { ownerExplanations, useExplanationsStore } from '@/store/useExplanationsStore';
import { bounded, cardRadii, colors, layout, spacing, textStyles, typography } from '@/theme';

import { clearExplainDraftIfUnchanged, EXPLANATION_MAX, explainDraft, explainRoute, isValidExplanation, PROMPTS, setExplainDraft, type ExplainDraft, type PromptId } from './explainModel';

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

function useExplanations() {
  const owner = useRecordsOwner();
  const status = useExplanationsStore((s) => s.status);
  const raw = useExplanationsStore((s) => s.saved[owner]);
  const entries = useMemo(() => ownerExplanations({ [owner]: raw } as never, owner), [owner, raw]);
  useEffect(() => {
    void useExplanationsStore.getState().load();
  }, []);
  return { owner, status, entries };
}

/* ---------- /culture/item/[itemId]/explain ---------- */

export function ExplainScreen({ articleId, onPressBack }: { articleId: string; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { owner, status, entries } = useExplanations();
  const items = useAllCultureItems();
  const article: CultureItemRow | null = items.data?.find((item) => item.id === articleId) ?? null;
  const saved = entries[articleId] ?? null;
  const [draft, setDraftState] = useState<ExplainDraft | null>(() => explainDraft(owner, articleId));
  const [showSource, setShowSource] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const shownOwner = useRef(owner);
  useEffect(() => {
    if (shownOwner.current === owner) return;
    shownOwner.current = owner; // another account: never the previous one's writing
    setDraftState(explainDraft(owner, articleId));
    setFailed(false);
    setJustSaved(false);
  }, [owner, articleId]);

  const title = article?.title ?? saved?.titleSnapshot ?? '';
  const promptId: PromptId = draft?.promptId ?? saved?.promptId ?? 'friend';
  const text = draft?.text ?? saved?.text ?? '';
  const dirty = !!draft && (draft.text !== (saved?.text ?? '') || draft.promptId !== (saved?.promptId ?? 'friend'));
  const change = (next: Partial<ExplainDraft>) => {
    const value: ExplainDraft = { text, promptId, titleSnapshot: title, ...next };
    value.text = value.text.slice(0, EXPLANATION_MAX);
    setExplainDraft(owner, articleId, value);
    setDraftState(value);
    setJustSaved(false);
  };
  const save = async () => {
    if (!draft) return;
    const startedFor = owner;
    const sent = draft;
    setBusy(true);
    const ok = await useExplanationsStore.getState().save(startedFor, { articleId, titleSnapshot: sent.titleSnapshot || title, promptId: sent.promptId, text: sent.text });
    setBusy(false);
    if (shownOwner.current !== startedFor) return;
    if (!ok) {
      setFailed(true); // the saved text stays as it was; the new words stay here
      announce(t('explain.saveFailed'));
      return;
    }
    setFailed(false);
    setJustSaved(true);
    clearExplainDraftIfUnchanged(startedFor, articleId, sent);
    setDraftState(explainDraft(startedFor, articleId));
    announce(t('explain.saved'));
  };
  const sections = article ? renderedSectionKeys(article) : [];

  return (
    <View style={styles.root}>
      <Header title={t('explain.title')} onPressBack={onPressBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled" testID="explain">
        <Text style={styles.cardTitle}>{title || t('explain.untitled')}</Text>
        {items.data && !article ? (
          <Text style={styles.warn} testID="explain-article-missing">
            {t('explain.articleMissing')}
          </Text>
        ) : null}
        <Text style={styles.note}>{t('explain.ownWords')}</Text>

        <Text style={styles.section}>{t('explain.promptTitle')}</Text>
        <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={t('explain.promptTitle')}>
          {PROMPTS.map((id) => (
            <AnimatedPressable key={id} style={[styles.chip, promptId === id && styles.chipOn]} onPress={() => change({ promptId: id })} accessibilityRole="radio" accessibilityState={{ checked: promptId === id }} aria-checked={promptId === id} testID={`explain-prompt-${id}`}>
              <Text style={[styles.chipText, promptId === id && styles.chipTextOn]}>{t(`explain.prompts.${id}`)}</Text>
            </AnimatedPressable>
          ))}
        </View>

        {status !== 'ready' ? (
          <Text style={styles.meta}>{status === 'error' ? t('explain.loadError') : t('explain.loading')}</Text>
        ) : (
          <>
            <TextField label={t(`explain.prompts.${promptId}`)} value={text} onChangeText={(value) => change({ text: value })} multiline numberOfLines={6} placeholder={t('explain.placeholder')} testID="explain-text" />
            <Text style={styles.meta}>{t('explain.count', { count: text.length, max: EXPLANATION_MAX })}</Text>
            {saved && dirty ? (
              <Text style={styles.meta} testID="explain-revising">
                {t('explain.revising')}
              </Text>
            ) : null}
            <Button label={failed ? t('common.retry') : saved ? t('explain.saveRevision') : t('explain.save')} loading={busy} disabled={!dirty || !isValidExplanation(text)} onPress={save} testID="explain-save" />
            {failed ? (
              <Text style={styles.warn} accessibilityLiveRegion="polite" testID="explain-save-failed">
                {t('explain.saveFailed')}
              </Text>
            ) : null}
            {justSaved && !dirty ? (
              <Text style={styles.meta} accessibilityLiveRegion="polite" testID="explain-saved">
                {t('explain.saved')}
              </Text>
            ) : null}
            {saved ? <Text style={styles.meta}>{t('explain.savedMeta', { count: saved.revisions })}</Text> : null}
          </>
        )}

        {article ? (
          <>
            <Button label={showSource ? t('explain.hideSource') : t('explain.showSource')} variant="secondary" onPress={() => setShowSource(!showSource)} testID="explain-toggle-source" />
            {showSource ? (
              <View style={styles.source} testID="explain-source">
                <Text style={styles.meta}>{t('explain.sourceNote')}</Text>
                {sections.map((key) => (
                  <View key={key} style={styles.stack}>
                    <Text style={styles.label}>{sectionLabelKey(key) ? t(sectionLabelKey(key)!) : key}</Text>
                    <Text style={styles.body}>{String(article[key as keyof CultureItemRow] ?? '')}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Button label={t('explain.openArticle')} variant="text" onPress={() => router.push(`/culture/item/${encodeURIComponent(articleId)}` as never)} testID="explain-open-article" />
          </>
        ) : null}
        <Text style={styles.meta}>{t('explain.storageNote')}</Text>
      </ScrollView>
    </View>
  );
}

/* ---------- /profile/explanations ---------- */

export function ExplanationsListScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { status, entries } = useExplanations();
  const items = useAllCultureItems();
  const list = Object.values(entries).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <View style={styles.root}>
      <Header title={t('explain.listTitle')} onPressBack={onPressBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="explanations">
        <Text style={styles.note}>{t('explain.ownWords')}</Text>
        {status === 'ready' && list.length === 0 ? <Text style={styles.meta}>{t('explain.none')}</Text> : null}
        {list.map((entry) => {
          const live = items.data?.find((item) => item.id === entry.articleId);
          return (
            <AnimatedPressable key={entry.articleId} style={styles.card} onPress={() => router.push(explainRoute(entry.articleId) as never)} accessibilityRole="button" testID={`explanation-${entry.articleId}`}>
              <View style={styles.row}>
                <Text style={[styles.cardTitle, styles.flex]}>{live?.title ?? entry.titleSnapshot}</Text>
                <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
              </View>
              {items.data && !live ? <Text style={styles.warn}>{t('explain.articleMissing')}</Text> : null}
              <Text style={styles.body} numberOfLines={3}>
                {entry.text}
              </Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md, ...bounded(layout.maxContentWidth) },
  stack: { gap: 4 },
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.sm },
  label: { ...textStyles.overline, color: colors.primary },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  source: { gap: spacing.sm, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt, borderLeftWidth: 3, borderLeftColor: colors.primary },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  chipTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
});
