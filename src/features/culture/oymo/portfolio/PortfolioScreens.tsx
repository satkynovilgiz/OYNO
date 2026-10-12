import { router } from 'expo-router';
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, ImageOff, Share2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotFoundState } from '@/components/system/NotFoundState';
import { AnimatedPressable, Button, IconButton, TextField, Toggle } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { announce } from '@/services/a11y/announce';
import { draftMap, ownerKey } from '@/services/drafts/draftRegistry';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useOymoCreations } from '@/services/content/oymoCreationsService';
import { useShareCard } from '@/services/share/useShareCard';
import { ownerPortfolio, ownerPortfolios, usePortfolioStore } from '@/store/usePortfolioStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { OymoArtwork } from '../components/OymoArtwork';
import { CAPTION_MAX, draftAfterSave, INTRO_MAX, MAX_ENTRIES, moveEntry, newPortfolio, portfolioCardContent, rename, resolveEntries, setCaption, setIntro, TITLE_MAX, toggleEntry, type Portfolio, type PortfolioCard, type ResolvedEntry } from './portfolioModel';

export const portfolioRoute = (id: string) => `/profile/oymo-portfolios/${encodeURIComponent(id)}`;
/** Logical exported card (captured at 3x by the share flow). */
export const PORTFOLIO_CARD_SIZE = { width: 360, height: 450 };

/** Unsaved edits per owner + portfolio (memory) - kept while the share sheet or another screen is open. */
/** Unsaved edits per owner + portfolio (memory; listable by the Recovery Center). */
const drafts = draftMap<Portfolio>('portfolio');

function usePortfolios() {
  const owner = useRecordsOwner();
  const status = usePortfolioStore((state) => state.status);
  const saved = usePortfolioStore((state) => state.saved);
  useEffect(() => {
    void usePortfolioStore.getState().load();
  }, []);
  return { owner, status, saved };
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

/** The exported card and its preview - one component, so the export shows exactly these fields. */
export function PortfolioCardView({ card }: { card: PortfolioCard }) {
  const { t } = useTranslation();
  const fixed = { allowFontScaling: false, maxFontSizeMultiplier: 1 } as const;
  return (
    <View style={[styles.exportCard, PORTFOLIO_CARD_SIZE]} testID="portfolio-export-card">
      {card.portfolioTitle ? <Text {...fixed} style={styles.exportTitle} numberOfLines={2} testID="portfolio-export-title">{card.portfolioTitle}</Text> : null}
      <View style={styles.exportArt}>
        <OymoArtwork layers={card.artwork.layers} backgroundColor={card.artwork.backgroundColor} symmetryMode={card.artwork.symmetry} size={220} />
      </View>
      <Text {...fixed} style={styles.exportName} numberOfLines={2} testID="portfolio-export-name">{card.designName || t('oymoPortfolio.untitledDesign')}</Text>
      {card.caption ? <Text {...fixed} style={styles.exportCaption} numberOfLines={3} testID="portfolio-export-caption">{card.caption}</Text> : null}
    </View>
  );
}

/** /profile/oymo-portfolios - your portfolios, and a new one. */
export function PortfolioListScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { owner, status, saved } = usePortfolios();
  const [title, setTitle] = useState('');
  const [failed, setFailed] = useState(false);
  const portfolios = ownerPortfolios(saved, owner);
  const create = async () => {
    const portfolio = newPortfolio(title);
    if (!(await usePortfolioStore.getState().save(owner, portfolio))) return setFailed(true);
    setFailed(false);
    setTitle('');
    router.push(portfolioRoute(portfolio.id) as never);
  };
  return (
    <View style={styles.root}>
      <Header title={t('oymoPortfolio.title')} onPressBack={onPressBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled" testID="portfolio-list">
        <Text style={styles.body}>{t('oymoPortfolio.intro', { max: MAX_ENTRIES })}</Text>
        <Text style={styles.note}>{t('oymoPortfolio.liveNote')}</Text>
        {status === 'error' ? (
          <View style={styles.card}>
            <Text style={styles.body}>{t('oymoPortfolio.loadError')}</Text>
            <Button label={t('oymoPortfolio.retry')} size="sm" onPress={() => void usePortfolioStore.getState().retryLoad()} />
          </View>
        ) : null}
        <View style={styles.card}>
          <TextField testID="portfolio-new-title" label={t('oymoPortfolio.titleLabel')} value={title} onChangeText={(value) => setTitle(value.slice(0, TITLE_MAX))} placeholder={t('oymoPortfolio.titlePlaceholder')} />
          {failed ? <Text style={styles.warn}>{t('oymoPortfolio.saveFailed')}</Text> : null}
          <Button label={failed ? t('oymoPortfolio.retry') : t('oymoPortfolio.create')} disabled={status !== 'ready' || !title.trim()} onPress={() => void create()} testID="portfolio-create" />
        </View>
        {portfolios.map((portfolio) => (
          <AnimatedPressable key={portfolio.id} style={styles.row} onPress={() => router.push(portfolioRoute(portfolio.id) as never)} accessibilityRole="button" accessibilityLabel={`${portfolio.title || t('oymoPortfolio.untitled')}. ${t('oymoPortfolio.designCount', { count: portfolio.entries.length })}`} testID={`portfolio-open-${portfolio.id}`}>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{portfolio.title || t('oymoPortfolio.untitled')}</Text>
              <Text style={styles.meta}>{t('oymoPortfolio.designCount', { count: portfolio.entries.length })}</Text>
            </View>
            <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
          </AnimatedPressable>
        ))}
        <Text style={styles.meta}>{t('oymoPortfolio.storageNote')}</Text>
      </ScrollView>
    </View>
  );
}

type View_ = 'edit' | 'grid' | 'single' | 'list';

/** /profile/oymo-portfolios/[id] - edit, arrange, preview, export one card. */
export function PortfolioScreen({ portfolioId, onPressBack }: { portfolioId: string; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { experience } = useAgeExperience();
  const { owner, status, saved } = usePortfolios();
  const creations = useOymoCreations();
  const { share, shareHost, isSharing } = useShareCard();
  const stored = ownerPortfolio(saved, owner, portfolioId);
  const key = ownerKey(owner, portfolioId);
  const [draft, setDraftState] = useState<Portfolio | null>(() => drafts.get(key) ?? null);
  const shownKey = useRef(key);
  useEffect(() => {
    if (shownKey.current === key) return;
    shownKey.current = key;
    setDraftState(drafts.get(key) ?? null); // another account: never the previous one's edits
  }, [key]);
  const [mode, setMode] = useState<View_>('edit');
  const [single, setSingle] = useState(0);
  const [exportId, setExportId] = useState<string | null>(null);
  const [includeCaption, setIncludeCaption] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (status === 'error') return <NotFoundState onPressBack={onPressBack} />;
  if (status !== 'ready') return <View style={styles.root} />;
  const portfolio = draft ?? stored;
  if (!portfolio) return <NotFoundState onPressBack={onPressBack} />;
  const dirty = !!draft;
  const edit = (next: Portfolio) => {
    drafts.set(key, next);
    setDraftState(next);
  };
  const save = async () => {
    setBusy(true);
    const startedFor = owner;
    const ok = await usePortfolioStore.getState().save(startedFor, portfolio);
    setBusy(false);
    if (shownKey.current !== ownerKey(startedFor, portfolioId)) return;
    if (!ok) {
      // Nothing changed in storage; the edits stay on screen.
      setFailed(true);
      announce(t('oymoPortfolio.saveFailed'));
      return;
    }
    setFailed(false);
    // Only what was sent is now saved; edits made during the write stay as the draft.
    const remaining = draftAfterSave(drafts.get(key), portfolio);
    if (remaining) drafts.set(key, remaining);
    else drafts.delete(key);
    setDraftState(remaining);
    announce(t('oymoPortfolio.saved'));
  };

  const designs = creations.data ?? null;
  const resolved = resolveEntries(portfolio, designs);
  const shown = resolved.filter((entry): entry is Extract<ResolvedEntry, { status: 'ok' }> => entry.status === 'ok');
  const exportEntry = shown.find((entry) => entry.creationId === exportId) ?? shown[0] ?? null;
  const card = exportEntry ? portfolioCardContent(portfolio, exportEntry, includeCaption) : null;
  const large = experience === 'child';
  const columns = large || width < 360 ? 1 : 2;
  const tile = Math.floor((Math.min(width, 520) - spacing.lg * 2 - spacing.sm * (columns - 1)) / columns);
  const nameOf = (entry: ResolvedEntry) => (entry.status === 'ok' ? entry.design.name || t('oymoPortfolio.untitledDesign') : entry.status === 'missing' ? t('oymoPortfolio.missingTitle') : '…');
  const scaledCard = Math.min(1, (Math.min(width, 520) - spacing.lg * 2) / PORTFOLIO_CARD_SIZE.width);

  const entryVisual = (entry: ResolvedEntry, size: number) =>
    entry.status === 'ok' ? (
      <View style={[styles.art, { width: size, height: size }]} accessible accessibilityRole="image" accessibilityLabel={t('oymoPortfolio.designA11y', { name: nameOf(entry), count: entry.design.layers.length })}>
        <OymoArtwork layers={entry.design.layers} backgroundColor={entry.design.background_color} symmetryMode={entry.design.symmetry_mode} size={size} />
      </View>
    ) : (
      <View style={[styles.art, styles.placeholder, { width: size, height: size }]} testID={`portfolio-missing-${entry.position}`}>
        <ImageOff size={22} color={colors.textSecondary} strokeWidth={2} />
        <Text style={styles.meta}>{entry.status === 'missing' ? t('oymoPortfolio.missing') : t('oymoPortfolio.loading')}</Text>
      </View>
    );
  const captionBlock = (entry: ResolvedEntry) =>
    entry.caption.trim() ? (
      <View style={styles.caption}>
        <Text style={styles.captionLabel}>{t('oymoPortfolio.yourCaption')}</Text>
        <Text style={styles.body}>{entry.caption}</Text>
      </View>
    ) : null;

  return (
    <View style={styles.root}>
      <Header title={portfolio.title || t('oymoPortfolio.untitled')} onPressBack={onPressBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled" testID="portfolio-screen">
        <View style={styles.wrap} accessibilityRole="tablist">
          {(['edit', 'grid', 'single', 'list'] as const).map((id) => (
            <AnimatedPressable key={id} style={[styles.chip, mode === id && styles.chipOn]} onPress={() => setMode(id)} accessibilityRole="tab" accessibilityState={{ selected: mode === id }} testID={`portfolio-mode-${id}`}>
              <Text style={[styles.chipText, mode === id && styles.chipTextOn]}>{t(`oymoPortfolio.modes.${id}`)}</Text>
            </AnimatedPressable>
          ))}
        </View>

        {mode === 'edit' ? (
          <View style={styles.stack} testID="portfolio-edit">
            <TextField testID="portfolio-title" label={t('oymoPortfolio.titleLabel')} value={portfolio.title} onChangeText={(value) => edit(rename(portfolio, value))} />
            <TextField testID="portfolio-intro" label={t('oymoPortfolio.introLabel')} value={portfolio.intro} onChangeText={(value) => edit(setIntro(portfolio, value.slice(0, INTRO_MAX)))} multiline numberOfLines={3} placeholder={t('oymoPortfolio.introPlaceholder')} />
            <Text style={styles.section} accessibilityRole="header">
              {t('oymoPortfolio.chosen', { count: portfolio.entries.length, max: MAX_ENTRIES })}
            </Text>
            {resolved.map((entry, index) => (
              <View key={entry.creationId} style={styles.entryRow} testID={`portfolio-entry-${index}`}>
                {entryVisual(entry, 72)}
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>{nameOf(entry)}</Text>
                  {entry.status === 'missing' ? <Text style={styles.warn}>{t('oymoPortfolio.missingHelp')}</Text> : null}
                  <TextField testID={`portfolio-caption-${index}`} label={t('oymoPortfolio.captionLabel')} value={entry.caption} onChangeText={(value) => edit(setCaption(portfolio, entry.creationId, value.slice(0, CAPTION_MAX)))} placeholder={t('oymoPortfolio.captionPlaceholder')} />
                  <Button label={t('oymoPortfolio.remove')} variant="text" size="sm" onPress={() => edit(toggleEntry(portfolio, entry.creationId))} testID={`portfolio-remove-${index}`} />
                </View>
                <View style={styles.moveColumn}>
                  <IconButton icon={ArrowUp} size={36} iconSize={14} elevated={false} disabled={index === 0} accessibilityLabel={t('oymoPortfolio.moveUp', { name: nameOf(entry) })} onPress={() => edit(moveEntry(portfolio, index, -1))} testID={`portfolio-up-${index}`} />
                  <IconButton icon={ArrowDown} size={36} iconSize={14} elevated={false} disabled={index === resolved.length - 1} accessibilityLabel={t('oymoPortfolio.moveDown', { name: nameOf(entry) })} onPress={() => edit(moveEntry(portfolio, index, 1))} testID={`portfolio-down-${index}`} />
                </View>
              </View>
            ))}
            <Text style={styles.section}>{t('oymoPortfolio.pickTitle')}</Text>
            {creations.isError ? <Text style={styles.warn}>{t('oymoPortfolio.designsError')}</Text> : null}
            {designs && designs.length === 0 ? <Text style={styles.meta}>{t('oymoPortfolio.noDesigns')}</Text> : null}
            {(designs ?? []).map((design) => {
              const on = portfolio.entries.some((entry) => entry.creationId === design.id);
              const full = !on && portfolio.entries.length >= MAX_ENTRIES;
              return (
                <AnimatedPressable key={design.id} style={[styles.pick, on && styles.pickOn]} disabled={full} onPress={() => edit(toggleEntry(portfolio, design.id))} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: full }} aria-checked={on} accessibilityLabel={design.name || t('oymoPortfolio.untitledDesign')} testID={`portfolio-pick-${design.id}`}>
                  {on ? <Check size={16} color={colors.primary} strokeWidth={2.5} /> : <View style={styles.box} />}
                  <Text style={[styles.body, styles.flex]}>{design.name || t('oymoPortfolio.untitledDesign')}</Text>
                </AnimatedPressable>
              );
            })}
            {failed ? (
              <Text style={styles.warn} accessibilityLiveRegion="polite" testID="portfolio-save-failed">
                {t('oymoPortfolio.saveFailed')}
              </Text>
            ) : null}
            <Button label={failed ? t('oymoPortfolio.retry') : t('oymoPortfolio.save')} disabled={busy || !dirty} onPress={() => void save()} testID="portfolio-save" />
            {dirty ? <Text style={styles.meta} testID="portfolio-unsaved">{t('oymoPortfolio.unsaved')}</Text> : null}
          </View>
        ) : null}

        {mode === 'grid' ? (
          <View style={styles.stack} testID="portfolio-grid">
            {portfolio.intro.trim() ? <Text style={[styles.body, styles.italic]}>{portfolio.intro}</Text> : null}
            <View style={styles.grid}>
              {resolved.map((entry) => (
                <View key={entry.creationId} style={{ width: tile, gap: 4 }}>
                  {entryVisual(entry, tile)}
                  <Text style={styles.cardTitle}>{nameOf(entry)}</Text>
                  {captionBlock(entry)}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {mode === 'single' && resolved.length ? (
          <View style={styles.stack} testID="portfolio-single">
            <Text style={styles.meta}>{t('oymoPortfolio.designOf', { count: resolved.length, current: Math.min(single, resolved.length - 1) + 1, total: resolved.length })}</Text>
            {entryVisual(resolved[Math.min(single, resolved.length - 1)], Math.min(width - spacing.lg * 2, 320))}
            <Text style={styles.cardTitle}>{nameOf(resolved[Math.min(single, resolved.length - 1)])}</Text>
            {captionBlock(resolved[Math.min(single, resolved.length - 1)])}
            <View style={styles.wrap}>
              <Button label={t('oymoPortfolio.previous')} variant="secondary" disabled={single === 0} onPress={() => setSingle(single - 1)} testID="portfolio-prev" />
              <Button label={t('oymoPortfolio.next')} disabled={single >= resolved.length - 1} onPress={() => setSingle(single + 1)} testID="portfolio-next" />
            </View>
          </View>
        ) : null}

        {mode === 'list' ? (
          <View style={styles.stack} testID="portfolio-text-list">
            {portfolio.intro.trim() ? <Text style={styles.body}>{portfolio.intro}</Text> : null}
            {resolved.map((entry) => (
              <View key={entry.creationId} style={styles.card}>
                <Text style={styles.cardTitle}>
                  {entry.position + 1}. {nameOf(entry)}
                </Text>
                <Text style={styles.meta}>{entry.status === 'ok' ? t('oymoPortfolio.motifs', { count: entry.design.layers.length }) : entry.status === 'missing' ? t('oymoPortfolio.missing') : '…'}</Text>
                {captionBlock(entry)}
              </View>
            ))}
          </View>
        ) : null}

        {mode !== 'edit' ? (
          <View style={styles.card} testID="portfolio-export">
            <Text style={styles.section} accessibilityRole="header">
              {t('oymoPortfolio.exportTitle')}
            </Text>
            {shown.length === 0 ? (
              <Text style={styles.meta}>{t('oymoPortfolio.nothingToExport')}</Text>
            ) : (
              <>
                <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={t('oymoPortfolio.exportWhich')}>
                  {shown.map((entry) => (
                    <AnimatedPressable key={entry.creationId} style={[styles.chip, exportEntry?.creationId === entry.creationId && styles.chipOn]} onPress={() => setExportId(entry.creationId)} accessibilityRole="radio" accessibilityState={{ checked: exportEntry?.creationId === entry.creationId }} aria-checked={exportEntry?.creationId === entry.creationId} testID={`portfolio-export-pick-${entry.position}`}>
                      <Text style={[styles.chipText, exportEntry?.creationId === entry.creationId && styles.chipTextOn]}>{nameOf(entry)}</Text>
                    </AnimatedPressable>
                  ))}
                </View>
                <View style={styles.toggleRow}>
                  <Text style={[styles.body, styles.flex]}>{t('oymoPortfolio.includeCaption')}</Text>
                  <Toggle value={includeCaption} onValueChange={setIncludeCaption} accessibilityLabel={t('oymoPortfolio.includeCaption')} />
                </View>
                <Text style={styles.meta}>{t('oymoPortfolio.exportFields')}</Text>
                {card ? (
                  <View style={{ width: PORTFOLIO_CARD_SIZE.width * scaledCard, height: PORTFOLIO_CARD_SIZE.height * scaledCard, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: colors.borderSubtle }} testID="portfolio-export-preview">
                    <View style={{ ...PORTFOLIO_CARD_SIZE, transform: [{ scale: scaledCard }], transformOrigin: 'top left' }}>
                      <PortfolioCardView card={card} />
                    </View>
                  </View>
                ) : null}
                <Button label={t('oymoPortfolio.export')} icon={<Share2 size={16} color={colors.textOnPrimary} strokeWidth={2.25} />} disabled={!card || isSharing} onPress={() => card && void share({ variant: 'postcard', title: card.designName || t('oymoPortfolio.untitledDesign'), label: t('oymoPortfolio.label'), imageSource: null, cardSize: PORTFOLIO_CARD_SIZE, artwork: <PortfolioCardView card={card} /> }, card.designName || t('oymoPortfolio.label'))} testID="portfolio-export-button" />
                {Platform.OS === 'web' ? <Text style={styles.meta}>{t('oymoPortfolio.webNote')}</Text> : null}
              </>
            )}
          </View>
        ) : null}
        <Text style={styles.meta}>{t('oymoPortfolio.storageNote')}</Text>
      </ScrollView>
      {shareHost}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  stack: { gap: spacing.sm },
  flex: { flex: 1, gap: 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  section: { ...typography.overline, color: colors.textSecondary },
  body: { ...textStyles.body, color: colors.textPrimary },
  italic: { fontStyle: 'italic' },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  entryRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  moveColumn: { gap: spacing.xs },
  art: { borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderSubtle },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 4, padding: spacing.xs, backgroundColor: colors.surfaceMuted },
  caption: { gap: 2, padding: spacing.xs, borderRadius: 8, backgroundColor: colors.surfaceAlt, borderLeftWidth: 3, borderLeftColor: colors.accentBrown },
  captionLabel: { ...textStyles.overline, color: colors.accentBrownDark },
  pick: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.borderSubtle },
  pickOn: { borderColor: colors.primary },
  box: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: colors.textSecondary },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  chipTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  exportCard: { padding: 20, gap: 10, alignItems: 'center', backgroundColor: colors.surface, overflow: 'hidden' },
  exportTitle: { fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.primary, textAlign: 'center' },
  exportArt: { borderRadius: 12, overflow: 'hidden' },
  exportName: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  exportCaption: { fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' },
});
