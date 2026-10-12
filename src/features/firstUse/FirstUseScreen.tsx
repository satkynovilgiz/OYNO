import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton, TextField } from '@/components/ui';
import { CANVAS_SIZE, OymoCanvas } from '@/features/culture/oymo/components/OymoCanvas';
import { ColorSwatches } from '@/features/culture/oymo/components/ColorSwatches';
import { MotifGrid } from '@/features/culture/oymo/components/MotifGrid';
import { OYMO_MOTIFS, type OymoMotifId } from '@/features/culture/oymo/motifs';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { announce } from '@/services/a11y/announce';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { addLayer, EMPTY_OYMO_STATE, MAX_OYMO_LAYERS, type OymoEditorState } from '@/services/culture/oymoEditor';
import { useAuthStore } from '@/store/useAuthStore';
import { useFirstUseStore } from '@/store/useFirstUseStore';
import { useProgressStore } from '@/store/useProgressStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { currentStep, draftFor, FIRST_USE_STEPS, homeCard, keepDraft, normalizeRecord, pickArticle, saveGuideDesign, type FirstUseStep } from './firstUseModel';

const GUIDE_LAYERS = 12;

/**
 * /start - the first-use guide (firstUseModel.ts). Four explicit steps; the
 * design lives in memory until it is really saved, and "saved" is only shown
 * after the save succeeded. A guest is told saving needs an account and is
 * asked to sign in only at the save step - the design waits for them.
 */
export function FirstUseScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const owner = useRecordsOwner();
  const isGuest = owner === 'guest';
  const queryClient = useQueryClient();
  const items = useAllCultureItems();
  const status = useFirstUseStore((state) => state.status);
  const rawRecord = useFirstUseStore((state) => state.saved[owner]);
  const record = useMemo(() => normalizeRecord(rawRecord), [rawRecord]);
  const [design, setDesign] = useState<OymoEditorState>(EMPTY_OYMO_STATE);
  const [name, setName] = useState('');
  const [motif, setMotif] = useState<OymoMotifId>(OYMO_MOTIFS[0].id);
  const [color, setColor] = useState<string>(colors.primary);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [writeFailed, setWriteFailed] = useState(false);
  const shownOwner = useRef(owner);

  useEffect(() => {
    void useFirstUseStore.getState().load();
  }, []);
  // The design is this owner's (or a guest's, handed to the account that just signed in).
  useEffect(() => {
    shownOwner.current = owner;
    const { draft, adoptedFrom } = draftFor(owner);
    setDesign(draft?.state ?? EMPTY_OYMO_STATE);
    setName(draft?.name ?? '');
    setSaveFailed(false);
    if (adoptedFrom) void useFirstUseStore.getState().adopt(adoptedFrom, owner);
  }, [owner, status]);
  const keep = (state: OymoEditorState, nextName = name, awaitingAuth = false) => keepDraft({ owner, state, symmetry: 'fourWay', name: nextName, awaitingAuth });
  const edit = (state: OymoEditorState) => {
    setDesign(state);
    keep(state);
  };
  const report = (ok: boolean) => setWriteFailed(!ok);

  const step = record ? currentStep(record) : null;
  const ids = (items.data ?? []).map((item) => item.id);
  const articleId = pickArticle(ids);
  const article = items.data?.find((item) => item.id === articleId) ?? null;

  const openArticle = async () => {
    if (!articleId) return;
    report(await useFirstUseStore.getState().done(owner, 'article'));
    router.push(`/culture/item/${articleId}` as never);
  };
  const finishCreating = async () => report(await useFirstUseStore.getState().done(owner, 'create'));
  const save = async () => {
    const forOwner = owner;
    setSaving(true);
    setSaveFailed(false);
    const finalName = name.trim() || t('firstUse.defaultName');
    const outcome = await saveGuideDesign({
      save: () => useProgressStore.getState().saveOymoCreation({ name: finalName, layers: design.layers, backgroundColor: design.backgroundColor, symmetryMode: 'fourWay' }),
      markSaved: () => useFirstUseStore.getState().done(forOwner, 'save', { saveChoice: 'saved', savedName: finalName }),
    });
    if (outcome !== 'failed') void queryClient.invalidateQueries({ queryKey: ['oymo_creations'] });
    if (shownOwner.current !== forOwner) return; // another account meanwhile: nothing of this is shown to it
    setSaving(false);
    if (outcome === 'failed') {
      setSaveFailed(true); // the design stays here
      announce(t('firstUse.save.failed'));
      return;
    }
    announce(t('firstUse.save.saved', { name: finalName }));
    report(outcome === 'saved');
  };
  const notSaving = async () => {
    keepDraft(null);
    report(await useFirstUseStore.getState().done(owner, 'save', { saveChoice: 'not_saved', savedName: null }));
  };
  const signInToSave = () => {
    keep(design, name, true);
    router.push('/sign-in' as never);
  };
  const openShelf = async () => {
    report(await useFirstUseStore.getState().done(owner, 'find'));
    router.push('/profile/shelf' as never);
  };
  const skipGuide = async () => {
    keepDraft(null);
    report(await useFirstUseStore.getState().skip(owner));
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
        {t('firstUse.title')}
      </Text>
    </View>
  );

  let body: React.ReactNode;
  if (status === 'error') {
    body = (
      <View style={styles.stack} testID="first-use-load-error">
        <Text style={styles.warn}>{t('firstUse.loadError')}</Text>
        <Button label={t('common.retry')} onPress={() => void useFirstUseStore.getState().retryLoad()} />
      </View>
    );
  } else if (status !== 'ready') {
    body = <Text style={styles.meta}>{t('firstUse.loading')}</Text>;
  } else if (!record || record.status === 'skipped' || record.status === 'offered') {
    body = (
      <View style={styles.stack} testID="first-use-offer">
        <Text style={styles.body}>{t('firstUse.intro')}</Text>
        <Text style={styles.note}>{t('firstUse.noTest')}</Text>
        <Button label={t('firstUse.start')} size="lg" onPress={async () => report(await useFirstUseStore.getState().start(owner))} testID="first-use-start" />
        {record?.status === 'offered' ? <Button label={t('firstUse.skip')} variant="text" onPress={skipGuide} testID="first-use-skip" /> : null}
      </View>
    );
  } else if (record.status === 'finished') {
    body = (
      <View style={styles.stack} testID="first-use-finished">
        <Text style={styles.heading} accessibilityRole="header">
          {t('firstUse.finishedTitle')}
        </Text>
        <Text style={styles.body}>{record.saveChoice === 'saved' ? t('firstUse.finishedSaved', { name: record.savedName ?? '' }) : t('firstUse.finishedNotSaved')}</Text>
        <Text style={styles.meta}>{t('firstUse.replayNote')}</Text>
        <Button label={t('firstUse.openShelf')} variant="secondary" onPress={() => router.push('/profile/shelf' as never)} testID="first-use-shelf-again" />
        <Button label={t('firstUse.replay')} variant="text" onPress={async () => report(await useFirstUseStore.getState().start(owner))} testID="first-use-replay" />
      </View>
    );
  } else {
    const stepBody = (which: FirstUseStep) => {
      if (which === 'article') {
        return article ? (
          <View style={styles.stack}>
            <Text style={styles.body}>{t('firstUse.article.body')}</Text>
            <Text style={styles.cardTitle}>{article.title}</Text>
            <Button label={t('firstUse.article.open')} onPress={openArticle} testID="first-use-open-article" />
          </View>
        ) : (
          <Text style={styles.meta} testID="first-use-no-article">
            {items.isError ? t('firstUse.article.offline') : t('firstUse.loading')}
          </Text>
        );
      }
      if (which === 'create') {
        const full = design.layers.length >= GUIDE_LAYERS;
        return (
          <View style={styles.stack}>
            <Text style={styles.body}>{t('firstUse.create.body')}</Text>
            <Text style={styles.section}>{t('firstUse.create.one')}</Text>
            <MotifGrid selectedMotifId={motif} onSelectMotif={setMotif} color={color} />
            <Text style={styles.section}>{t('firstUse.create.two')}</Text>
            <ColorSwatches selectedColor={color} onSelectColor={setColor} />
            <Text style={styles.section}>{t('firstUse.create.three')}</Text>
            <View style={styles.canvas}>
              <OymoCanvas layers={design.layers} backgroundColor={design.backgroundColor} symmetryMode="fourWay" selectedLayerId={null} onTapCanvas={(point) => !full && edit(addLayer(design, point, motif, color))} onSelectLayer={() => undefined} />
            </View>
            <View style={styles.wrap}>
              <Button label={t('culture.oymo.placeAtCenter')} variant="secondary" size="sm" disabled={full} onPress={() => edit(addLayer(design, { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 }, motif, color))} testID="first-use-place" />
              <Button label={t('firstUse.create.undo')} variant="secondary" size="sm" disabled={design.layers.length === 0} onPress={() => edit({ ...design, layers: design.layers.slice(0, -1) })} testID="first-use-undo" />
            </View>
            <Text style={styles.meta} testID="first-use-count">
              {t('firstUse.create.count', { count: design.layers.length, max: Math.min(GUIDE_LAYERS, MAX_OYMO_LAYERS) })}
            </Text>
            <Button label={t('firstUse.create.done')} disabled={design.layers.length === 0} onPress={finishCreating} testID="first-use-create-done" />
          </View>
        );
      }
      if (which === 'save') {
        return (
          <View style={styles.stack}>
            <View style={styles.preview}>
              <OymoCanvas layers={design.layers} backgroundColor={design.backgroundColor} symmetryMode="fourWay" selectedLayerId={null} onTapCanvas={() => undefined} onSelectLayer={() => undefined} />
            </View>
            {design.layers.length === 0 ? <Text style={styles.warn} testID="first-use-design-gone">{t('firstUse.save.gone')}</Text> : null}
            {isGuest ? (
              <>
                <Text style={styles.note} testID="first-use-guest-note">
                  {t('firstUse.save.guest')}
                </Text>
                <Button label={t('firstUse.save.signIn')} disabled={design.layers.length === 0} onPress={signInToSave} testID="first-use-sign-in" />
              </>
            ) : (
              <>
                <Text style={styles.body}>{t('firstUse.save.account')}</Text>
                <TextField label={t('firstUse.save.nameLabel')} value={name} onChangeText={(value) => {
                  setName(value.slice(0, 60));
                  keep(design, value.slice(0, 60));
                }} placeholder={t('firstUse.defaultName')} testID="first-use-name" />
                <Button label={t('firstUse.save.save')} loading={saving} disabled={design.layers.length === 0} onPress={save} testID="first-use-save" />
                {saveFailed ? (
                  <Text style={styles.warn} accessibilityLiveRegion="polite" testID="first-use-save-failed">
                    {t('firstUse.save.failed')}
                  </Text>
                ) : null}
              </>
            )}
            <Button label={t('firstUse.save.dontSave')} variant="text" disabled={saving} onPress={notSaving} testID="first-use-dont-save" />
          </View>
        );
      }
      return (
        <View style={styles.stack}>
          <Text style={styles.body}>{record.saveChoice === 'saved' ? t('firstUse.find.saved', { name: record.savedName ?? '' }) : t('firstUse.find.notSaved')}</Text>
          <Button label={t('firstUse.openShelf')} onPress={openShelf} testID="first-use-open-shelf" />
        </View>
      );
    };
    body = (
      <View style={styles.stack} testID="first-use-guide">
        {FIRST_USE_STEPS.map((which, index) => {
          const isDone = !!record.done[which];
          const isCurrent = which === step;
          return (
            <View key={which} style={[styles.card, isCurrent && styles.current]} testID={`first-use-step-${which}`}>
              <View style={styles.row}>
                {isDone ? <Check size={16} color={colors.primary} strokeWidth={2.5} /> : null}
                <Text style={[styles.cardTitle, styles.flex]}>
                  {index + 1}. {t(`firstUse.steps.${which}`)}
                </Text>
                <Text style={styles.meta}>{isDone ? t('firstUse.stepDone') : isCurrent ? t('firstUse.stepNow') : ''}</Text>
              </View>
              {isCurrent ? stepBody(which) : null}
            </View>
          );
        })}
        <Button label={t('firstUse.skipGuide')} variant="text" onPress={skipGuide} testID="first-use-skip-guide" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        {writeFailed ? (
          <Text style={styles.warn} testID="first-use-write-failed">
            {t('firstUse.writeFailed')}
          </Text>
        ) : null}
        {body}
      </ScrollView>
    </View>
  );
}

/** Home: offered once after onboarding (per owner); "Continue" while a run is unfinished. */
export function FirstUseHomeCard() {
  const { t } = useTranslation();
  const owner = useRecordsOwner();
  const status = useFirstUseStore((state) => state.status);
  const rawRecord = useFirstUseStore((state) => state.saved[owner]);
  const record = useMemo(() => normalizeRecord(rawRecord), [rawRecord]);
  const signedOutGate = useAuthStore((state) => state.status === 'unauthenticated');
  useEffect(() => {
    void useFirstUseStore.getState().load();
  }, []);
  if (status !== 'ready' || signedOutGate) return null;
  const kind = homeCard(record);
  if (!kind) return null;
  return (
    <View style={styles.homeCard} testID={`first-use-card-${kind}`}>
      <Text style={styles.cardTitle}>{kind === 'offer' ? t('firstUse.cardTitle') : t('firstUse.cardContinueTitle')}</Text>
      <Text style={styles.meta}>{t('firstUse.cardBody')}</Text>
      <View style={styles.wrap}>
        <Button
          label={kind === 'offer' ? t('firstUse.start') : t('firstUse.continue')}
          onPress={async () => {
            if (kind === 'offer' && !(await useFirstUseStore.getState().start(owner))) return; // not started unless stored
            router.push('/start' as never);
          }}
          testID="first-use-card-start"
        />
        <Button label={kind === 'offer' ? t('firstUse.skip') : t('firstUse.skipGuide')} variant="text" onPress={() => void useFirstUseStore.getState().skip(owner)} testID="first-use-card-skip" />
      </View>
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
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.xs },
  heading: { ...typography.h2, color: colors.textPrimary },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  homeCard: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.primary },
  current: { borderColor: colors.primary, borderWidth: 2 },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  canvas: { alignSelf: 'center' },
  preview: { alignSelf: 'center', transform: [{ scale: 0.6 }], marginVertical: -CANVAS_SIZE * 0.2 },
});
