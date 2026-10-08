import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Share2 } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KyrgyzOnlyNote } from '@/components/content/KyrgyzOnlyNote';
import { SourcesAndNotes } from '@/components/content/SourcesAndNotes';
import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';
import { AnimatedPressable, Button, IconButton, MediaImage } from '@/components/ui';
import { cultureItemImages } from '@/features/culture/data';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { track } from '@/services/analytics/analytics';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import type { CultureItemRow } from '@/services/content/types';
import { normalizeVerification, verificationCopyKey } from '@/services/content/verification';
import { isWaitingForNetwork } from '@/services/offline/offlineManifest';
import { useShareCard } from '@/services/share/useShareCard';
import { cardRadii, colors, editorial, radii, spacing, textStyles, typography } from '@/theme';

import { buildCompareShareCard } from './compareShare';
import { COMPARE_LABEL_KEY, COMPARE_PRESENTATION, compareRoute, compareRows, comparisonById, CULTURE_COMPARISONS, type CultureComparison } from './cultureCompare';

const imageOf = (itemId: string): ImageSourcePropType | null => cultureItemImages[itemId]?.[0] ?? null;
const itemRoute = (itemId: string) => `/culture/item/${itemId}`;

/** /culture/compare - the curated pairs (no free item-vs-item picker). */
export function CultureCompareListScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const query = useAllCultureItems();
  const items = query.data;
  if (isWaitingForNetwork(query)) return <OfflineUnavailable onRetry={() => void query.refetch()} />;
  const titleOf = (id: string) => items?.find((item) => item.id === id)?.title ?? null;
  const available = CULTURE_COMPARISONS.filter((pair) => titleOf(pair.leftItemId) && titleOf(pair.rightItemId));

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.screenTitle} accessibilityRole="header" numberOfLines={1}>
          {t('compare.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Text style={styles.intro}>{t('compare.intro')}</Text>
        <Button label={t('compare.free.chooseYourOwn')} variant="secondary" onPress={() => router.push('/culture/compare/pick' as never)} testID="compare-choose-own" />
        {!items ? <ActivityIndicator color={colors.primary} /> : null}
        {available.map((pair) => (
          <AnimatedPressable
            key={pair.id}
            style={styles.pairRow}
            onPress={() => router.push(compareRoute(pair.id) as never)}
            press="soft"
            accessibilityRole="button"
            accessibilityLabel={t('compare.pairLabel', { left: titleOf(pair.leftItemId), right: titleOf(pair.rightItemId) })}
          >
            <View style={styles.pairImages}>
              <View style={styles.pairThumb}>{imageOf(pair.leftItemId) ? <MediaImage source={imageOf(pair.leftItemId)!} /> : null}</View>
              <View style={styles.pairThumb}>{imageOf(pair.rightItemId) ? <MediaImage source={imageOf(pair.rightItemId)!} /> : null}</View>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.pairTitle} numberOfLines={1}>
                {titleOf(pair.leftItemId)}
              </Text>
              <Text style={styles.vs}>{t('compare.and')}</Text>
              <Text style={styles.pairTitle} numberOfLines={1}>
                {titleOf(pair.rightItemId)}
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
          </AnimatedPressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** /culture/compare/[id] - two authored stories, field by field, stacked. */
export function CultureCompareScreen({ id, onPressBack }: { id: string; onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const presentation = COMPARE_PRESENTATION[experience];
  const { share, shareHost } = useShareCard();
  const pair = comparisonById(id);
  const query = useAllCultureItems();
  const left = pair ? query.data?.find((item) => item.id === pair.leftItemId) : undefined;
  const right = pair ? query.data?.find((item) => item.id === pair.rightItemId) : undefined;

  useEffect(() => {
    if (pair && left && right) track('culture_compare_opened', { comparison_id: pair.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair?.id, !!left, !!right]);

  if (isWaitingForNetwork(query)) return <OfflineUnavailable onRetry={() => void query.refetch()} />;

  const header = (title: string | null, shareAction: (() => void) | null) => (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <View style={{ flex: 1 }}>
        <Text style={styles.kicker}>{t('compare.title')}</Text>
        {title ? (
          <Text style={[styles.title, presentation.editorial && styles.titleEditorial]} accessibilityRole="header" numberOfLines={2}>
            {title}
          </Text>
        ) : null}
      </View>
      {shareAction ? <IconButton icon={Share2} shape="roundedSquare" accessibilityLabel={t('compare.share')} onPress={shareAction} /> : null}
    </View>
  );

  if (!pair || (query.data && (!left || !right))) {
    return (
      <View style={styles.root}>
        {header(null, null)}
        <View style={styles.center}>
          <Text style={styles.body}>{t('compare.unavailable')}</Text>
          <Button label={t('compare.allPairs')} variant="secondary" onPress={() => router.replace('/culture/compare' as never)} />
        </View>
      </View>
    );
  }
  if (!left || !right) {
    return (
      <View style={styles.root}>
        {header(null, null)}
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  const rows = compareRows(pair, left, right, experience).slice(0, presentation.maxFields);
  const onShare = () =>
    void share(
      buildCompareShareCard({ leftTitle: left.title, rightTitle: right.title, leftImage: imageOf(left.id), rightImage: imageOf(right.id), label: t('compare.shareLabel') }),
      t('compare.shareMessage', { left: left.title, right: right.title }),
    );

  return (
    <View style={styles.root}>
      {header(`${left.title} · ${right.title}`, onShare)}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.visual}>
          {[left, right].map((item) => (
            <View key={item.id} style={styles.visualSide} accessible accessibilityLabel={item.title}>
              <View style={[styles.visualImage, presentation.largeImages && styles.visualImageLarge]}>{imageOf(item.id) ? <MediaImage source={imageOf(item.id)!} /> : null}</View>
              <Text style={styles.visualTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.status}>{t(verificationCopyKey(normalizeVerification(item.accuracy_level)))}</Text>
            </View>
          ))}
        </View>
        <SideNote item={left} language={i18n.language} />
        <SideNote item={right} language={i18n.language} />

        {rows.map((row) => (
          <View key={row.field} style={styles.field}>
            <Text style={styles.fieldHeading} accessibilityRole="header">
              {t(COMPARE_LABEL_KEY[row.field])}
            </Text>
            <Side title={left.title} label={t(COMPARE_LABEL_KEY[row.field])} text={row.left} tone="left" />
            <Side title={right.title} label={t(COMPARE_LABEL_KEY[row.field])} text={row.right} tone="right" />
          </View>
        ))}

        {[left, right].map((item) => (
          <View key={`more-${item.id}`} style={styles.sources}>
            <Text style={styles.sourcesTitle} accessibilityRole="header">
              {item.title}
            </Text>
            <SourcesAndNotes contentType="culture_item" level={item.accuracy_level} sources={item.sources} contentId={item.id} />
            <Button label={t('compare.openStory', { title: item.title })} variant="secondary" block onPress={() => router.push(itemRoute(item.id) as never)} />
          </View>
        ))}
      </ScrollView>
      {shareHost}
    </View>
  );
}

function SideNote({ item, language }: { item: CultureItemRow; language: string }) {
  if (language === 'kg' || item.translation?.status !== 'fallback_to_kg') return null;
  return (
    <View style={{ gap: 2 }}>
      <Text style={styles.noteTitle}>{item.title}</Text>
      <KyrgyzOnlyNote status={item.translation?.status} language={language} />
    </View>
  );
}

/** One side of a field. Screen readers hear "Title - Field: text", so
 * which item a paragraph belongs to is never ambiguous. */
function Side({ title, label, text, tone }: { title: string; label: string; text: string; tone: 'left' | 'right' }) {
  return (
    <View style={[styles.side, tone === 'left' ? styles.sideLeft : styles.sideRight]} accessible accessibilityLabel={`${title} - ${label}: ${text}`}>
      <Text style={styles.sideTitle}>{title}</Text>
      <Text style={styles.body}>{text}</Text>
    </View>
  );
}

export function CompareEntryRow() {
  const { t } = useTranslation();
  return (
    <AnimatedPressable style={styles.entry} onPress={() => router.push('/culture/compare' as never)} press="soft" accessibilityRole="button" accessibilityLabel={`${t('compare.entry')}. ${t('compare.entryMeta', { count: CULTURE_COMPARISONS.length })}`}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.pairTitle}>{t('compare.entry')}</Text>
        <Text style={styles.meta}>{t('compare.entryMeta', { count: CULTURE_COMPARISONS.length })}</Text>
      </View>
      <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
    </AnimatedPressable>
  );
}

export type { CultureComparison };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  screenTitle: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  kicker: { ...textStyles.overline, color: colors.accentTerracotta },
  title: { ...textStyles.h3, color: colors.textPrimary },
  titleEditorial: { ...editorial(textStyles.h3) },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  intro: { ...textStyles.body, color: colors.textSecondary },
  pairRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  pairImages: { flexDirection: 'row', gap: 4 },
  pairThumb: { width: 52, height: 64, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  pairTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  vs: { ...textStyles.small, color: colors.textMuted },
  meta: { ...textStyles.small, color: colors.textSecondary },
  visual: { flexDirection: 'row', gap: spacing.sm },
  visualSide: { flex: 1, gap: 4 },
  visualImage: { width: '100%', aspectRatio: 1, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  visualImageLarge: { aspectRatio: 0.85 },
  visualTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  status: { ...textStyles.small, color: colors.textSecondary },
  noteTitle: { ...textStyles.small, fontWeight: '700', color: colors.textSecondary },
  field: { gap: spacing.xs },
  fieldHeading: { ...textStyles.overline, color: colors.accentTerracotta, marginTop: spacing.sm },
  side: { gap: 4, padding: spacing.md, borderRadius: radii.lg, borderLeftWidth: 3 },
  sideLeft: { backgroundColor: colors.surfaceAlt, borderLeftColor: colors.accentGold },
  sideRight: { backgroundColor: colors.surface, borderLeftColor: colors.primary },
  sideTitle: { ...textStyles.small, fontWeight: '700', color: colors.textMuted },
  body: { ...textStyles.body, fontSize: 16, lineHeight: 25, color: colors.textPrimary },
  sources: { gap: spacing.xs, marginTop: spacing.sm },
  sourcesTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  entry: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
});
