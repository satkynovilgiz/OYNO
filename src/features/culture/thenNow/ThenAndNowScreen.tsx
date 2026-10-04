import { ChevronLeft, Share2 } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KyrgyzOnlyNote } from '@/components/content/KyrgyzOnlyNote';
import { SourcesAndNotes } from '@/components/content/SourcesAndNotes';
import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { IconButton, MediaImage } from '@/components/ui';
import { RelatedItemsRail } from '@/features/culture/components';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { track } from '@/services/analytics/analytics';
import type { CultureItemRow } from '@/services/content/types';
import { useShareCard } from '@/services/share/useShareCard';
import { colors, editorial, radii, spacing, textStyles } from '@/theme';

import { FIELD_LABEL_KEY, THEN_NOW_PRESENTATION, thenAndNowFor, type ThenNowPart } from './thenAndNow';
import { buildThenNowShareCard } from './thenNowShare';

/**
 * /culture/item/[id]/then-now - the full authored Then and Now texts,
 * stacked, with the item's own verification and sources unchanged and the
 * existing related rail at the end. No timeline, no dates, no new words.
 */
export function ThenAndNowScreen({ item, image, onPressBack }: { item: CultureItemRow; image: ImageSourcePropType | null; onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const { share, shareHost } = useShareCard();
  const model = thenAndNowFor(item);
  const presentation = THEN_NOW_PRESENTATION[experience];
  const headingKey = presentation.headings === 'simple' ? 'simple' : 'standard';

  useEffect(() => {
    if (model) track('culture_then_now_opened', { content_id: item.id, content_type: 'culture_item' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>{t('thenNow.title')}</Text>
          <Text style={[styles.title, presentation.editorial && styles.titleEditorial]} accessibilityRole="header" numberOfLines={2}>
            {item.title}
          </Text>
        </View>
        {model ? (
          <IconButton
            icon={Share2}
            shape="roundedSquare"
            accessibilityLabel={t('thenNow.share')}
            onPress={() => void share(buildThenNowShareCard({ title: item.title, label: t('thenNow.title'), image }), t('thenNow.shareMessage', { title: item.title }))}
          />
        ) : null}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        {!model ? (
          <Text style={styles.body}>{t('thenNow.unavailable')}</Text>
        ) : (
          <>
            {image ? (
              <View style={styles.image}>
                <MediaImage source={image} />
              </View>
            ) : null}
            <KyrgyzOnlyNote status={item.translation?.status} language={i18n.language} />
            <Block tone="then" heading={t(`thenNow.then.${headingKey}`)} parts={model.then} />
            <View style={styles.divider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <OymoOrnament size={16} color={colors.accentGold} strokeWidth={1.5} />
            </View>
            <Block tone="now" heading={t(`thenNow.now.${headingKey}`)} parts={model.now} />
            <SourcesAndNotes contentType="culture_item" level={item.accuracy_level} sources={item.sources} contentId={item.id} />
            <View style={styles.relatedBleed}>
              <RelatedItemsRail item={item} />
            </View>
          </>
        )}
      </ScrollView>
      {shareHost}
    </View>
  );
}

function Block({ tone, heading, parts }: { tone: 'then' | 'now'; heading: string; parts: ThenNowPart[] }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.block, tone === 'then' ? styles.blockThen : styles.blockNow]}>
      <Text style={[styles.heading, tone === 'now' && styles.headingNow]} accessibilityRole="header">
        {heading}
      </Text>
      {parts.map((part) => (
        <View key={part.field} style={{ gap: 4 }}>
          <Text style={styles.fieldLabel}>{t(FIELD_LABEL_KEY[part.field])}</Text>
          <Text style={styles.body}>{part.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  kicker: { ...textStyles.overline, color: colors.accentTerracotta },
  title: { ...textStyles.h3, color: colors.textPrimary },
  titleEditorial: { ...editorial(textStyles.h3) },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  image: { width: '100%', aspectRatio: 1.6, borderRadius: radii.xl, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  block: { gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, borderLeftWidth: 3 },
  blockThen: { backgroundColor: colors.surfaceAlt, borderLeftColor: colors.accentGold },
  blockNow: { backgroundColor: colors.surface, borderLeftColor: colors.primary },
  heading: { ...textStyles.h3, color: colors.accentGoldPressed },
  headingNow: { color: colors.primary },
  fieldLabel: { ...textStyles.overline, color: colors.textMuted },
  body: { ...textStyles.body, fontSize: 16, lineHeight: 25, color: colors.textPrimary },
  divider: { alignItems: 'center' },
  relatedBleed: { marginHorizontal: -spacing.lg },
});
