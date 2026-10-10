import { router } from 'expo-router';
import { ArrowDown, ArrowUp, Check, ChevronLeft, Eye, Quote, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton, TextField } from '@/components/ui';
import { connectionRoute, contentRoute, SOURCE_FIELD_LABEL } from '@/features/culture/connections/connectionsData';
import { useConnectionContent } from '@/features/culture/connections/useConnectionContent';
import { announce } from '@/services/a11y/announce';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { ownerDraft, useChallengeDraftStore } from '@/store/useChallengeDraftStore';
import { useMyCollectionsStore } from '@/store/useMyCollectionsStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { NAME_MAX } from '../myCollectionsModel';
import { useContentResolver, useMyCollections } from '../useMyCollections';
import { complete, connectionsBetween, MAX_PICKS, MIN_PICKS, movePick, pickKey, PROMPTS, requirements, setCaption, setIntro, setName, setPrompt, startDraft, suggestedPicks, toExhibition, togglePick, type ChallengeDraft, type Pick, type Requirement, type Section } from './challengeModel';
import { CAPTION_MAX, INTRO_MAX, slidesFor } from './museumModel';
import { VisitorTour } from './VisitorTour';

/**
 * /profile/my-collections/challenge - Curator Challenge: a prompt, 3-5
 * available articles in your order, an introduction and optional
 * captions, a Visitor Preview (the real guided tour), then Save: a normal
 * private collection with its exhibition, opened in Mini Museum. The draft
 * is kept per owner on this device while you open sources or the preview.
 */
export function CuratorChallengeScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { owner, isLoaded: collectionsLoaded } = useMyCollections();
  const saved = useChallengeDraftStore((state) => state.saved);
  const draftsLoaded = useChallengeDraftStore((state) => state.isLoaded);
  const content = useConnectionContent();
  const { resolve, ready } = useContentResolver();
  const { isOffline } = useNetworkStatus();
  const [search, setSearch] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Partial<Record<Section, number>>>({});
  useEffect(() => {
    void useChallengeDraftStore.getState().load();
  }, []);
  // Another account: its own draft (or none) - and no preview of the previous one.
  useEffect(() => {
    setPreviewing(false);
    setFailed(false);
  }, [owner]);

  const draft = ownerDraft(saved, owner);
  const update = (change: (current: ChallengeDraft) => ChallengeDraft) => {
    const current = ownerDraft(useChallengeDraftStore.getState().saved, owner);
    if (current) useChallengeDraftStore.getState().put(owner, change(current));
  };
  const isAvailable = (pick: Pick) => !ready || !!resolve(pick.type, pick.id);
  const exhibition = useMemo(() => (draft ? toExhibition(draft) : null), [draft]);
  const slides = exhibition ? slidesFor(exhibition, resolve, ready) : [];

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={previewing ? () => setPreviewing(false) : onPressBack} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
        {t('curatorChallenge.title')}
      </Text>
    </View>
  );
  if (!draftsLoaded || !collectionsLoaded) return <View style={styles.root}>{header}</View>;

  // 1. Choose a prompt (no draft yet).
  if (!draft) {
    return (
      <View style={styles.root}>
        {header}
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="challenge-start">
          <Text style={styles.body}>{t('curatorChallenge.intro', { min: MIN_PICKS, max: MAX_PICKS })}</Text>
          <Text style={styles.note}>{t('curatorChallenge.guidanceNote')}</Text>
          {PROMPTS.map((id) => (
            <AnimatedPressable key={id} style={styles.promptCard} onPress={() => useChallengeDraftStore.getState().put(owner, startDraft(id))} accessibilityRole="button" testID={`challenge-prompt-${id}`}>
              <Text style={styles.cardTitle}>{t(`curatorChallenge.prompts.${id}`)}</Text>
            </AnimatedPressable>
          ))}
        </ScrollView>
      </View>
    );
  }

  const reqs = requirements(draft, isAvailable);
  const done = complete(draft, isAvailable);
  const goTo = (section: Section) => scrollRef.current?.scrollTo({ y: Math.max(0, (positions.current[section] ?? 0) - spacing.md), animated: false });
  const reqText = (req: Requirement) =>
    req.id === 'count'
      ? t('curatorChallenge.req.count', { min: MIN_PICKS, max: MAX_PICKS, count: req.detail?.count ?? 0 })
      : req.id === 'available'
        ? req.ok
          ? t('curatorChallenge.req.availableOk')
          : t('curatorChallenge.req.availableMissing', { count: req.detail?.missing?.length ?? 0 })
        : t(`curatorChallenge.req.${req.id}`);
  const titleOf = (pick: Pick) => (ready ? (resolve(pick.type, pick.id)?.title ?? pick.titleSnapshot) : pick.titleSnapshot);
  const query = search.trim().toLowerCase();
  const picked = new Set(draft.picks.map(pickKey));
  const full = draft.picks.length >= MAX_PICKS;
  const results = query.length >= 2 && !full ? content.all().filter((target) => !picked.has(`${target.type}:${target.id}`) && target.title.toLowerCase().includes(query)).slice(0, 8) : [];
  const suggestions = full ? [] : suggestedPicks(draft).filter((entry) => content.get(entry.type, entry.id));
  const between = connectionsBetween(draft);
  const add = (type: Pick['type'], id: string) => {
    const target = content.get(type, id);
    if (!target) return;
    update((current) => togglePick(current, { type, id, titleSnapshot: target.title }));
    setSearch('');
    announce(t('curatorChallenge.added', { name: target.title }));
  };
  const save = async () => {
    if (!exhibition || !done) return;
    setSaving(true);
    const id = await useMyCollectionsStore.getState().createWithExhibition(owner, { name: draft.name.trim(), items: draft.picks.map((pick) => ({ contentType: pick.type, contentId: pick.id })), exhibition });
    setSaving(false);
    if (!id) {
      setFailed(true);
      announce(t('curatorChallenge.saveFailed'));
      return;
    }
    setFailed(false);
    useChallengeDraftStore.getState().clear(owner);
    router.replace({ pathname: '/profile/my-collections/museum', params: { collection: id } } as never);
  };
  const layout = (section: Section) => ({ onLayout: (event: { nativeEvent: { layout: { y: number } } }) => (positions.current[section] = event.nativeEvent.layout.y) });

  if (previewing && exhibition) {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.previewBanner} testID="challenge-preview-banner">
          <Eye size={16} color={colors.textOnDark} strokeWidth={2.25} />
          <Text style={styles.previewBannerText}>{t('museum.preview.banner')}</Text>
          <Button label={t('curatorChallenge.backToDraft')} variant="secondary" size="sm" onPress={() => setPreviewing(false)} testID="challenge-preview-return" />
        </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
          <VisitorTour exhibition={exhibition} title={exhibition.title || t('curatorChallenge.untitled')} slides={slides} isOffline={isOffline} large={false} owner={owner} onEnd={() => setPreviewing(false)} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {header}
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled" testID="challenge-draft">
        <View style={styles.card} {...layout('prompt')}>
          <Text style={styles.section}>{t('curatorChallenge.promptTitle')}</Text>
          <View style={styles.wrap} accessibilityRole="radiogroup">
            {PROMPTS.map((id) => {
              const on = draft.promptId === id;
              return (
                <AnimatedPressable key={id} style={[styles.chip, on && styles.chipOn]} onPress={() => update((current) => setPrompt(current, id))} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} testID={`challenge-switch-${id}`}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{t(`curatorChallenge.prompts.${id}`)}</Text>
                </AnimatedPressable>
              );
            })}
          </View>
          <Text style={styles.meta}>{t(`curatorChallenge.tips.${draft.promptId}`)}</Text>
          <Text style={styles.meta}>{t('curatorChallenge.switchNote')}</Text>
        </View>

        <View {...layout('name')}>
          <TextField testID="challenge-name" label={t('curatorChallenge.nameLabel')} value={draft.name} onChangeText={(value) => update((current) => setName(current, value.slice(0, NAME_MAX)))} placeholder={t('curatorChallenge.namePlaceholder')} />
        </View>

        <View style={styles.stack} {...layout('picks')}>
          <Text style={styles.section} accessibilityRole="header">
            {t('curatorChallenge.picksTitle', { count: draft.picks.length, max: MAX_PICKS })}
          </Text>
          {draft.picks.map((pick, index) => {
            const key = pickKey(pick);
            const available = isAvailable(pick);
            return (
              <View key={key} style={styles.pickRow} testID={`challenge-pick-${index}`}>
                <View style={styles.flex}>
                  <Text style={styles.label}>{t('curatorChallenge.fromOyno')}</Text>
                  <Text style={styles.cardTitle}>
                    {index + 1}. {titleOf(pick)}
                  </Text>
                  {!available ? (
                    <Text style={styles.warn} testID={`challenge-pick-unavailable-${index}`}>
                      {t('curatorChallenge.unavailable')}
                    </Text>
                  ) : (
                    <Button label={t('curatorChallenge.openSource')} variant="text" size="sm" onPress={() => router.push(contentRoute(pick.type, pick.id) as never)} testID={`challenge-source-${index}`} />
                  )}
                  <View {...(index === 0 ? layout('captions') : {})}>
                    <TextField testID={`challenge-caption-${index}`} label={t('curatorChallenge.captionLabel')} value={draft.captions[key] ?? ''} onChangeText={(value) => update((current) => setCaption(current, key, value.slice(0, CAPTION_MAX)))} placeholder={t('curatorChallenge.captionPlaceholder')} />
                  </View>
                </View>
                <View style={styles.moveColumn}>
                  <IconButton icon={ArrowUp} size={36} iconSize={14} elevated={false} disabled={index === 0} accessibilityLabel={t('curatorChallenge.moveUp', { name: titleOf(pick) })} onPress={() => update((current) => movePick(current, index, -1))} testID={`challenge-up-${index}`} />
                  <IconButton icon={ArrowDown} size={36} iconSize={14} elevated={false} disabled={index === draft.picks.length - 1} accessibilityLabel={t('curatorChallenge.moveDown', { name: titleOf(pick) })} onPress={() => update((current) => movePick(current, index, 1))} testID={`challenge-down-${index}`} />
                  <IconButton icon={X} size={36} iconSize={14} elevated={false} accessibilityLabel={t('curatorChallenge.remove', { name: titleOf(pick) })} onPress={() => update((current) => togglePick(current, pick))} testID={`challenge-remove-${index}`} />
                </View>
              </View>
            );
          })}
          {full ? (
            <Text style={styles.meta}>{t('curatorChallenge.full', { max: MAX_PICKS })}</Text>
          ) : (
            <View style={styles.card}>
              <TextField testID="challenge-search" label={t('curatorChallenge.search')} value={search} onChangeText={setSearch} placeholder={t('curatorChallenge.searchPlaceholder')} />
              {results.map((target) => (
                <AnimatedPressable key={`${target.type}:${target.id}`} style={styles.listRow} onPress={() => add(target.type, target.id)} accessibilityRole="button" accessibilityLabel={t('curatorChallenge.addNamed', { name: target.title })} testID={`challenge-add-${target.id}`}>
                  <Text style={[styles.body, styles.flex]}>+ {target.title}</Text>
                </AnimatedPressable>
              ))}
              {suggestions.length ? <Text style={styles.meta}>{t('curatorChallenge.suggestionsNote')}</Text> : null}
              <View style={styles.wrap}>
                {suggestions.map((entry) => (
                  <AnimatedPressable key={`${entry.type}:${entry.id}`} style={styles.chip} onPress={() => add(entry.type, entry.id)} accessibilityRole="button" accessibilityLabel={t('curatorChallenge.addNamed', { name: content.get(entry.type, entry.id)?.title ?? '' })} testID={`challenge-suggest-${entry.id}`}>
                    <Text style={styles.chipText}>+ {content.get(entry.type, entry.id)?.title}</Text>
                  </AnimatedPressable>
                ))}
              </View>
            </View>
          )}
        </View>

        {between.length ? (
          <View style={styles.stack} testID="challenge-connections">
            <Text style={styles.section} accessibilityRole="header">
              {t('curatorChallenge.connectionsTitle')}
            </Text>
            {between.map((connection) => (
              <View key={connection.id} style={styles.sourced} testID={`challenge-connection-${connection.id}`}>
                <View style={styles.inline}>
                  <Quote size={14} color={colors.primary} strokeWidth={2} />
                  <Text style={styles.label}>{t('discoveryBoard.sourcedLabel')}</Text>
                </View>
                <Text style={styles.body}>
                  {content.get(connection.fromType, connection.fromId)?.title ?? connection.fromId} → {t(`culture.connections.relation.${connection.relationKey}`)} → {content.get(connection.toType, connection.toId)?.title ?? connection.toId}
                </Text>
                <Text style={styles.quote}>“{connection.evidence}”</Text>
                <Text style={styles.meta}>{t('culture.connections.fromArticle', { title: content.get(connection.source.contentType, connection.source.contentId)?.title ?? connection.source.contentId, section: SOURCE_FIELD_LABEL[connection.source.field] ? t(SOURCE_FIELD_LABEL[connection.source.field]) : connection.source.field })}</Text>
                <Button label={t('discoveryBoard.openConnection')} variant="text" size="sm" onPress={() => router.push(connectionRoute(connection.id) as never)} testID={`challenge-open-connection-${connection.id}`} />
              </View>
            ))}
          </View>
        ) : null}

        <View {...layout('intro')}>
          <TextField testID="challenge-intro" label={t('curatorChallenge.introLabel')} value={draft.intro} onChangeText={(value) => update((current) => setIntro(current, value.slice(0, INTRO_MAX)))} multiline numberOfLines={3} placeholder={t('curatorChallenge.introPlaceholder')} />
        </View>
        <Text style={styles.meta}>{t('curatorChallenge.yourWordsNote')}</Text>

        <View style={styles.card} testID="challenge-checklist">
          <Text style={styles.section} accessibilityRole="header">
            {t('curatorChallenge.checklistTitle')}
          </Text>
          {reqs.map((req) => (
            <AnimatedPressable key={req.id} style={styles.checkRow} onPress={() => goTo(req.section)} accessibilityRole="button" accessibilityLabel={`${req.ok ? t('curatorChallenge.done') : t('curatorChallenge.todo')}: ${reqText(req)}`} testID={`challenge-req-${req.id}`}>
              {req.ok ? <Check size={16} color={colors.primary} strokeWidth={2.5} /> : <View style={styles.box} />}
              <Text style={[styles.body, styles.flex]}>{reqText(req)}</Text>
            </AnimatedPressable>
          ))}
          <Text style={styles.meta}>{t('curatorChallenge.noJudging')}</Text>
        </View>

        <Button label={t('museum.preview.entry')} icon={<Eye size={16} color={colors.primary} strokeWidth={2.25} />} variant="secondary" disabled={draft.picks.length === 0} onPress={() => setPreviewing(true)} testID="challenge-preview" />
        {failed ? (
          <View style={[styles.card, styles.error]} accessibilityLiveRegion="polite" testID="challenge-save-failed">
            <Text style={styles.body}>{t('curatorChallenge.saveFailed')}</Text>
            <Button label={t('curatorChallenge.retry')} onPress={() => void save()} disabled={saving} testID="challenge-retry" />
          </View>
        ) : null}
        <Button label={t('curatorChallenge.save')} size="lg" disabled={!done || saving} onPress={() => void save()} testID="challenge-save" />
        <Text style={styles.meta}>{t('curatorChallenge.saveNote')}</Text>
        <Button label={t('curatorChallenge.discard')} variant="text" onPress={() => useChallengeDraftStore.getState().clear(owner)} testID="challenge-discard" />
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
  section: { ...typography.overline, color: colors.textSecondary },
  label: { ...textStyles.overline, color: colors.primary },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  quote: { ...textStyles.body, fontStyle: 'italic', color: colors.textPrimary },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  error: { borderColor: colors.accentTerracotta, borderLeftWidth: 4 },
  promptCard: { minHeight: 56, justifyContent: 'center', padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  pickRow: { flexDirection: 'row', gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  moveColumn: { gap: spacing.xs },
  listRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: 12, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.small, color: colors.textPrimary },
  chipTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
  sourced: { gap: 4, padding: spacing.sm, borderRadius: cardRadii.compact, borderWidth: 1, borderColor: colors.borderSubtle, borderLeftWidth: 3, borderLeftColor: colors.primary, backgroundColor: colors.surface },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  box: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: colors.textSecondary },
  previewBanner: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.surfaceFeature },
  previewBannerText: { ...textStyles.small, fontWeight: '700', color: colors.textOnDark, flex: 1, minWidth: 160 },
});
