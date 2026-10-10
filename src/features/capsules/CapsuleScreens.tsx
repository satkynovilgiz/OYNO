import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Lock, MailOpen, PenLine } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotFoundState } from '@/components/system/NotFoundState';
import { AnimatedPressable, Button, IconButton, TextField } from '@/components/ui';
import { contentRoute, type ConnectionContentType } from '@/features/culture/connections/connectionsData';
import { useConnectionContent } from '@/features/culture/connections/useConnectionContent';
import { OymoArtwork } from '@/features/culture/oymo/components/OymoArtwork';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import type { SupportedLanguage } from '@/i18n';
import { announce } from '@/services/a11y/announce';
import { localDateKey } from '@/services/daily/dailyDiscovery';
import { formatLongDate } from '@/services/i18n/formatDate';
import { ownerCapsule, ownerCapsules, useCapsuleStore } from '@/store/useCapsuleStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { addArticle, clampOpenOn, daysUntil, earliestOpenOn, editDraft, isDue, MAX_ARTICLES, MESSAGE_MAX, newCapsule, openCapsule, reflect, REFLECTION_MAX, removeArticle, seal, sealProblems, stepDate, takeOfferedDesign, TITLE_MAX, type Capsule } from './capsuleModel';

export const capsuleRoute = (id: string) => `/profile/capsules/${encodeURIComponent(id)}`;

/** Unsaved edits per owner + capsule, kept while an article is open (memory only). */
const drafts = new Map<string, Capsule>();
const draftKey = (owner: string, id: string) => `${owner}\u0000${id}`;

function useCapsules() {
  const owner = useRecordsOwner();
  const status = useCapsuleStore((state) => state.status);
  const saved = useCapsuleStore((state) => state.saved);
  useEffect(() => {
    void useCapsuleStore.getState().load();
  }, []);
  return { owner, status, saved };
}
const retryLoad = () => {
  useCapsuleStore.setState({ status: 'idle' });
  void useCapsuleStore.getState().load();
};

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

function LoadGate({ status, children }: { status: string; children: React.ReactNode }) {
  const { t } = useTranslation();
  if (status === 'error')
    return (
      <View style={styles.card} testID="capsule-load-error">
        <Text style={styles.body}>{t('timeCapsule.loadError')}</Text>
        <Button label={t('timeCapsule.retry')} onPress={retryLoad} testID="capsule-load-retry" />
      </View>
    );
  if (status !== 'ready') return <Text style={styles.meta}>{t('timeCapsule.loading')}</Text>;
  return <>{children}</>;
}

/** /profile/capsules - your capsules: drafts, sealed (and whether they can be opened), opened. */
export function CapsuleListScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { owner, status, saved } = useCapsules();
  const language = i18n.language as SupportedLanguage;
  const today = localDateKey();
  const capsules = ownerCapsules(saved, owner);
  const groups: { id: Capsule['status']; items: Capsule[] }[] = [
    { id: 'sealed', items: capsules.filter((capsule) => capsule.status === 'sealed') },
    { id: 'draft', items: capsules.filter((capsule) => capsule.status === 'draft') },
    { id: 'opened', items: capsules.filter((capsule) => capsule.status === 'opened') },
  ];
  return (
    <View style={styles.root}>
      <Header title={t('timeCapsule.title')} onPressBack={onPressBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Text style={styles.body}>{t('timeCapsule.intro')}</Text>
        <Text style={styles.note}>{t('timeCapsule.notEncryption')}</Text>
        <LoadGate status={status}>
          <Button label={t('timeCapsule.new')} icon={<PenLine size={16} color={colors.textOnPrimary} strokeWidth={2.25} />} onPress={() => router.push(capsuleRoute('new') as never)} testID="capsule-new" />
          {capsules.length === 0 ? <Text style={styles.meta}>{t('timeCapsule.none')}</Text> : null}
          {groups.map((group) =>
            group.items.length ? (
              <View key={group.id} style={styles.stack}>
                <Text style={styles.section} accessibilityRole="header">
                  {t(`timeCapsule.groups.${group.id}`)}
                </Text>
                {group.items.map((capsule) => {
                  const due = isDue(capsule, today);
                  const meta =
                    capsule.status === 'sealed' && capsule.openOn
                      ? due
                        ? t('timeCapsule.readyToOpen')
                        : t('timeCapsule.sealedUntil', { date: formatLongDate(capsule.openOn, language) })
                      : capsule.status === 'opened'
                        ? t('timeCapsule.openedMeta')
                        : t('timeCapsule.draftMeta');
                  return (
                    <AnimatedPressable key={capsule.id} style={styles.listRow} onPress={() => router.push(capsuleRoute(capsule.id) as never)} accessibilityRole="button" accessibilityLabel={`${capsule.title || t('timeCapsule.untitled')}. ${meta}`} testID={`capsule-row-${capsule.id}`}>
                      {capsule.status === 'sealed' ? <Lock size={16} color={colors.textSecondary} strokeWidth={2} /> : capsule.status === 'opened' ? <MailOpen size={16} color={colors.textSecondary} strokeWidth={2} /> : <PenLine size={16} color={colors.textSecondary} strokeWidth={2} />}
                      <View style={styles.flex}>
                        <Text style={styles.cardTitle} numberOfLines={2}>
                          {capsule.title || t('timeCapsule.untitled')}
                        </Text>
                        <Text style={[styles.meta, due && styles.due]}>{meta}</Text>
                      </View>
                      <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
                    </AnimatedPressable>
                  );
                })}
              </View>
            ) : null,
          )}
        </LoadGate>
        <Text style={styles.meta}>{t('timeCapsule.backupNote')}</Text>
      </ScrollView>
    </View>
  );
}

/** Accessible date control: the date in words, steps by day / month / year, and quick choices. */
function DateControl({ value, today, onChange, language }: { value: string | null; today: string; onChange: (date: string) => void; language: SupportedLanguage }) {
  const { t } = useTranslation();
  const current = value ?? earliestOpenOn(today);
  const set = (date: string) => {
    const next = clampOpenOn(date, today);
    onChange(next);
    announce(t('timeCapsule.dateChosen', { date: formatLongDate(next, language) }));
  };
  return (
    <View style={styles.card} testID="capsule-date">
      <Text style={styles.label}>{t('timeCapsule.openOnLabel')}</Text>
      <Text style={styles.dateText} accessibilityLiveRegion="polite" testID="capsule-date-value">
        {value ? formatLongDate(value, language) : t('timeCapsule.noDate')}
      </Text>
      {value ? <Text style={styles.meta}>{t('timeCapsule.inDays', { count: daysUntil(value, today) })}</Text> : null}
      <View style={styles.wrap}>
        {([['week', 7, 'day'], ['month', 1, 'month'], ['halfYear', 6, 'month'], ['year', 1, 'year']] as const).map(([id, amount, unit]) => (
          <Button key={id} label={t(`timeCapsule.quick.${id}`)} variant="secondary" size="sm" onPress={() => set(stepDate(today, unit, amount))} testID={`capsule-quick-${id}`} />
        ))}
      </View>
      {(['day', 'month', 'year'] as const).map((unit) => (
        <View key={unit} style={styles.wrap}>
          <Button label={t(`timeCapsule.earlier.${unit}`)} variant="text" size="sm" disabled={!value || stepDate(current, unit, -1) < earliestOpenOn(today)} onPress={() => set(stepDate(current, unit, -1))} testID={`capsule-earlier-${unit}`} />
          <Button label={t(`timeCapsule.later.${unit}`)} variant="text" size="sm" onPress={() => set(stepDate(current, unit, value ? 1 : 0))} testID={`capsule-later-${unit}`} />
        </View>
      ))}
      <Text style={styles.meta}>{t('timeCapsule.dateRule')}</Text>
    </View>
  );
}

/** /profile/capsules/[id] (or `new`) - write a draft, seal it, open it when the day comes, reflect. */
export function CapsuleScreen({ capsuleId, onPressBack }: { capsuleId: string; onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const language = i18n.language as SupportedLanguage;
  const { owner, status, saved } = useCapsules();
  const content = useConnectionContent();
  const today = localDateKey();
  const stored = capsuleId === 'new' ? null : ownerCapsule(saved, owner, capsuleId);
  const key = draftKey(owner, capsuleId);
  const initial = () => drafts.get(key) ?? (capsuleId === 'new' ? (() => {
    const fresh = newCapsule();
    const design = takeOfferedDesign(owner);
    return design ? { ...fresh, design } : fresh;
  })() : null);
  const [draft, setDraftState] = useState<Capsule | null>(initial);
  // Another account (key changes): never the previous owner's unsaved draft.
  const shownKey = useRef(key);
  useEffect(() => {
    if (shownKey.current === key) return;
    shownKey.current = key;
    setDraftState(drafts.get(key) ?? (capsuleId === 'new' ? newCapsule() : null));
  }, [key, capsuleId]);
  const [failed, setFailed] = useState<null | (() => Promise<void>)>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'early' | 'delete' | null>(null);
  const [search, setSearch] = useState('');
  const [reflection, setReflection] = useState<string | null>(null);

  const capsule = draft ?? stored;
  const setDraft = (next: Capsule) => {
    drafts.set(key, next);
    setDraftState(next);
  };
  /** Writes; on failure keeps everything on screen and offers Retry. */
  const persist = async (next: Capsule, after?: () => void) => {
    setBusy(true);
    const ok = await useCapsuleStore.getState().save(owner, next);
    setBusy(false);
    if (!ok) {
      setFailed(() => () => persist(next, after));
      announce(t('timeCapsule.saveFailed'));
      return;
    }
    setFailed(null);
    drafts.delete(key);
    setDraftState(null);
    after?.();
    if (capsuleId === 'new') router.replace(capsuleRoute(next.id) as never);
  };
  const destroy = async () => {
    setBusy(true);
    const ok = capsuleId === 'new' ? true : await useCapsuleStore.getState().remove(owner, capsuleId);
    setBusy(false);
    if (!ok) {
      setFailed(() => destroy);
      return;
    }
    drafts.delete(key);
    onPressBack();
  };

  const body = (() => {
    if (!capsule) return <NotFoundState onPressBack={onPressBack} />;
    if (capsule.status === 'draft') {
      const problems = sealProblems(capsule, today);
      const query = search.trim().toLowerCase();
      const results = query.length >= 2 && capsule.articles.length < MAX_ARTICLES ? content.all().filter((target) => !capsule.articles.some((entry) => entry.type === target.type && entry.id === target.id) && target.title.toLowerCase().includes(query)).slice(0, 6) : [];
      return (
        <View style={styles.stack} testID="capsule-draft">
          <TextField testID="capsule-title" label={t('timeCapsule.titleLabel')} value={capsule.title} onChangeText={(value) => setDraft(editDraft(capsule, { title: value.slice(0, TITLE_MAX) }))} />
          <TextField testID="capsule-message" label={t('timeCapsule.messageLabel')} value={capsule.message} onChangeText={(value) => setDraft(editDraft(capsule, { message: value.slice(0, MESSAGE_MAX) }))} multiline numberOfLines={6} placeholder={t('timeCapsule.messagePlaceholder')} />

          <View style={styles.card}>
            <Text style={styles.label}>{t('timeCapsule.articlesTitle', { count: capsule.articles.length, max: MAX_ARTICLES })}</Text>
            {capsule.articles.map((article) => (
              <View key={`${article.type}:${article.id}`} style={styles.listRow}>
                <Text style={[styles.body, styles.flex]}>{content.get(article.type, article.id)?.title ?? article.titleSnapshot}</Text>
                <Button label={t('timeCapsule.remove')} variant="text" size="sm" onPress={() => setDraft(removeArticle(capsule, article.type, article.id))} testID={`capsule-article-remove-${article.id}`} />
              </View>
            ))}
            {capsule.articles.length < MAX_ARTICLES ? <TextField testID="capsule-article-search" label={t('timeCapsule.findArticle')} value={search} onChangeText={setSearch} placeholder={t('timeCapsule.findPlaceholder')} /> : null}
            {results.map((target) => (
              <AnimatedPressable key={`${target.type}:${target.id}`} style={styles.listRow} onPress={() => { setDraft(addArticle(capsule, { type: target.type, id: target.id, titleSnapshot: target.title })); setSearch(''); }} accessibilityRole="button" accessibilityLabel={t('timeCapsule.addNamed', { name: target.title })} testID={`capsule-article-add-${target.id}`}>
                <Text style={[styles.body, styles.flex]}>+ {target.title}</Text>
              </AnimatedPressable>
            ))}
          </View>

          <View style={styles.card} testID="capsule-design">
            <Text style={styles.label}>{t('timeCapsule.designTitle')}</Text>
            {capsule.design ? (
              <>
                <View style={styles.artwork} accessible accessibilityRole="image" accessibilityLabel={t('timeCapsule.designA11y', { count: capsule.design.layers.length })}>
                  <OymoArtwork layers={capsule.design.layers} backgroundColor={capsule.design.backgroundColor} symmetryMode={capsule.design.symmetry} size={140} />
                </View>
                <Text style={styles.meta}>{t('timeCapsule.designSnapshotNote')}</Text>
                <Button label={t('timeCapsule.removeDesign')} variant="text" size="sm" onPress={() => setDraft(editDraft(capsule, { design: null }))} testID="capsule-design-remove" />
              </>
            ) : (
              <Text style={styles.meta}>{t('timeCapsule.designHow')}</Text>
            )}
          </View>

          <DateControl value={capsule.openOn} today={today} language={language} onChange={(openOn) => setDraft(editDraft(capsule, { openOn }))} />

          {problems.length > 0 && (capsule.title || capsule.message || capsule.openOn) ? (
            <View style={styles.card} testID="capsule-problems">
              {problems.map((problem) => (
                <Text key={problem} style={styles.meta}>
                  • {t(`timeCapsule.problems.${problem}`)}
                </Text>
              ))}
            </View>
          ) : null}
          <Text style={styles.note}>{t('timeCapsule.sealExplain')}</Text>
          <Button label={t('timeCapsule.saveDraft')} variant="secondary" disabled={busy} onPress={() => void persist(capsule)} testID="capsule-save-draft" />
          <Button label={t('timeCapsule.seal')} icon={<Lock size={16} color={colors.textOnPrimary} strokeWidth={2.25} />} disabled={busy || problems.length > 0} onPress={() => void persist(seal(capsule, today), () => announce(t('timeCapsule.sealedAnnounce')))} testID="capsule-seal" />
        </View>
      );
    }
    if (capsule.status === 'sealed') {
      const due = isDue(capsule, today);
      return (
        <View style={styles.stack} testID="capsule-sealed">
          <Lock size={28} color={colors.primary} strokeWidth={1.75} />
          <Text style={styles.heading}>{capsule.title}</Text>
          <Text style={styles.body} testID="capsule-sealed-until">
            {capsule.openOn ? (due ? t('timeCapsule.readyToOpen') : t('timeCapsule.sealedUntilLong', { date: formatLongDate(capsule.openOn, language), count: daysUntil(capsule.openOn, today) })) : t('timeCapsule.readyToOpen')}
          </Text>
          <Text style={styles.note}>{t('timeCapsule.notEncryption')}</Text>
          {due || !capsule.openOn ? (
            <Button label={t('timeCapsule.open')} onPress={() => void persist(openCapsule(capsule, today, { early: !capsule.openOn }))} disabled={busy} testID="capsule-open" />
          ) : confirm === 'early' ? (
            <View style={styles.card} testID="capsule-early-confirm">
              <Text style={styles.body}>{t('timeCapsule.earlyConfirm', { date: formatLongDate(capsule.openOn, language) })}</Text>
              <View style={styles.wrap}>
                <Button label={t('timeCapsule.earlyYes')} onPress={() => void persist(openCapsule(capsule, today, { early: true }), () => setConfirm(null))} disabled={busy} testID="capsule-early-yes" />
                <Button label={t('timeCapsule.earlyNo')} variant="text" onPress={() => setConfirm(null)} testID="capsule-early-no" />
              </View>
            </View>
          ) : (
            <Button label={t('timeCapsule.openEarly')} variant="secondary" onPress={() => setConfirm('early')} testID="capsule-open-early" />
          )}
        </View>
      );
    }
    const text = reflection ?? capsule.reflection;
    return (
      <View style={styles.stack} testID="capsule-opened">
        <Text style={styles.heading}>{capsule.title}</Text>
        <Text style={styles.meta}>
          {capsule.openedEarly ? t('timeCapsule.openedEarlyMeta') : t('timeCapsule.openedOnTimeMeta')}
          {capsule.openOn ? ` · ${t('timeCapsule.openOnMeta', { date: formatLongDate(capsule.openOn, language) })}` : ''}
        </Text>
        <View style={styles.card} testID="capsule-message-opened">
          <Text style={styles.label}>{t('timeCapsule.yourMessage')}</Text>
          <Text style={styles.body}>{capsule.message}</Text>
        </View>
        {capsule.articles.length ? (
          <View style={styles.card} testID="capsule-articles-opened">
            <Text style={styles.label}>{t('timeCapsule.articlesSaved')}</Text>
            {capsule.articles.map((article) => {
              const live = content.get(article.type as ConnectionContentType, article.id);
              const ready = !content.isLoading;
              return (
                <View key={`${article.type}:${article.id}`} style={styles.listRow} testID={`capsule-article-${article.id}`}>
                  <Text style={[styles.body, styles.flex]}>
                    {live?.title ?? article.titleSnapshot}
                    {!live && ready ? ` · ${t('timeCapsule.unavailable')}` : ''}
                  </Text>
                  {live ? <Button label={t('timeCapsule.openArticle')} variant="text" size="sm" onPress={() => router.push(contentRoute(article.type, article.id) as never)} /> : null}
                </View>
              );
            })}
          </View>
        ) : null}
        {capsule.design ? (
          <View style={styles.card} testID="capsule-design-opened">
            <Text style={styles.label}>{t('timeCapsule.designTitle')}</Text>
            <View style={styles.artwork} accessible accessibilityRole="image" accessibilityLabel={t('timeCapsule.designA11y', { count: capsule.design.layers.length })}>
              <OymoArtwork layers={capsule.design.layers} backgroundColor={capsule.design.backgroundColor} symmetryMode={capsule.design.symmetry} size={180} />
            </View>
          </View>
        ) : null}
        <TextField testID="capsule-reflection" label={t('timeCapsule.reflectionLabel')} value={text} onChangeText={(value) => setReflection(value.slice(0, REFLECTION_MAX))} multiline numberOfLines={5} placeholder={t('timeCapsule.reflectionPlaceholder')} />
        <Text style={styles.meta}>{t('timeCapsule.reflectionNote')}</Text>
        <Button label={t('timeCapsule.saveReflection')} disabled={busy || reflection === null} onPress={() => void persist(reflect(capsule, text), () => { setReflection(null); announce(t('timeCapsule.reflectionSaved')); })} testID="capsule-save-reflection" />
      </View>
    );
  })();

  return (
    <View style={styles.root}>
      <Header title={capsule?.title || t('timeCapsule.newTitle')} onPressBack={onPressBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <LoadGate status={status}>
          {failed ? (
            <View style={[styles.card, styles.error]} accessibilityLiveRegion="polite" testID="capsule-save-failed">
              <Text style={styles.body}>{t('timeCapsule.saveFailed')}</Text>
              <Button label={t('timeCapsule.retry')} onPress={() => void failed()} disabled={busy} testID="capsule-retry" />
            </View>
          ) : null}
          {body}
          {capsule ? (
            confirm === 'delete' ? (
              <View style={styles.card} testID="capsule-delete-confirm">
                <Text style={styles.body}>{t('timeCapsule.deleteConfirm')}</Text>
                <View style={styles.wrap}>
                  <Button label={t('timeCapsule.deleteYes')} variant="danger" disabled={busy} onPress={() => void destroy()} testID="capsule-delete-yes" />
                  <Button label={t('timeCapsule.deleteNo')} variant="text" onPress={() => setConfirm(null)} />
                </View>
              </View>
            ) : (
              <Button label={t('timeCapsule.delete')} variant="text" onPress={() => setConfirm('delete')} testID="capsule-delete" />
            )
          ) : null}
        </LoadGate>
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
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.sm },
  label: { ...textStyles.overline, color: colors.primary },
  heading: { ...typography.h2, color: colors.textPrimary },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  due: { color: colors.primary, fontWeight: '700' },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  dateText: { ...typography.h2, color: colors.textPrimary },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  error: { borderColor: colors.accentTerracotta, borderLeftWidth: 4 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  artwork: { alignSelf: 'flex-start', borderRadius: cardRadii.compact, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderSubtle },
});
