import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KyrgyzOnlyNote } from '@/components/content/KyrgyzOnlyNote';
import { SourcesAndNotes } from '@/components/content/SourcesAndNotes';
import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';
import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { NotFoundState } from '@/components/system/NotFoundState';
import { Button, IconButton, MediaImage } from '@/components/ui';
import { cultureItemImages } from '@/features/culture/data';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, editorial, radii, spacing, textStyles, typography } from '@/theme';

import type { GlossaryField } from './glossaryData';
import { useGlossary } from './useGlossary';

/** The existing article label for each source field. */
const FIELD_LABEL: Record<GlossaryField, string> = {
  history: 'culture.item.historyLabel',
  origin: 'culture.item.originLabel',
  cultural_meaning: 'culture.item.culturalMeaningLabel',
  objects_used: 'culture.item.objectsUsedLabel',
  traditional_method: 'culture.item.traditionalMethodLabel',
};

/** /culture/glossary/[id] - one term: the authored definition, the
 * source item's own image, its unchanged verification and sources, and
 * Learn more into the existing article (no copy of the article). */
export function GlossaryTermScreen({ termId, onPressBack }: { termId: string; onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';
  const { entries, isLoading, waitingForNetwork, retry } = useGlossary();

  if (waitingForNetwork) return <OfflineUnavailable onRetry={retry} />;
  if (isLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  const resolved = entries.find(({ entry }) => entry.id === termId);
  if (!resolved) return <NotFoundState onPressBack={onPressBack} />;
  const { entry, item, definition, alternateNames } = resolved;
  const image: ImageSourcePropType | null = item.image_url ? { uri: item.image_url } : (cultureItemImages[item.id]?.[0] ?? null);
  const fieldLabel = t(FIELD_LABEL[entry.sourceField]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.kicker}>{t('glossary.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={[styles.image, isChild && styles.imageChild]}>
          {image ? <MediaImage source={image} /> : <OymoOrnament size={64} color="rgba(232,185,61,0.5)" strokeWidth={1.25} />}
        </View>
        <Text style={[styles.term, isChild && styles.termChild, isAdult && styles.termEditorial]} accessibilityRole="header" accessibilityLabel={`${entry.term}. ${t('glossary.termA11y')}.`}>
          {entry.term}
        </Text>
        {alternateNames.length > 0 && !isChild ? <Text style={styles.alt}>{t('glossary.alsoKnownAs', { names: alternateNames.join(', ') })}</Text> : null}
        <KyrgyzOnlyNote status={item.translation?.status} language={i18n.language} />
        {!isChild ? <Text style={styles.fieldLabel}>{fieldLabel}</Text> : null}
        <Text style={styles.definition} numberOfLines={isChild ? 4 : undefined}>
          {definition}
        </Text>
        {!isChild ? <Text style={styles.context}>{t('glossary.from', { title: item.title })}</Text> : null}
        <SourcesAndNotes contentType="culture_item" level={item.accuracy_level} sources={item.sources} />
        <Button
          label={t('glossary.learnMore', { title: item.title })}
          variant="secondary"
          onPress={() => router.push(`/culture/item/${item.id}` as never)}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  kicker: { ...typography.overline, color: colors.accentTerracotta },
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  image: { width: '100%', aspectRatio: 1.7, borderRadius: radii.xl, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceFeature, marginBottom: spacing.sm },
  imageChild: { aspectRatio: 1.2 },
  term: { ...textStyles.display, color: colors.textPrimary },
  termChild: { fontSize: 40, lineHeight: 46 },
  termEditorial: { ...editorial(textStyles.display) },
  alt: { ...textStyles.small, fontStyle: 'italic', color: colors.textSecondary },
  fieldLabel: { ...typography.overline, color: colors.accentTerracotta, marginTop: spacing.xs },
  definition: { ...textStyles.body, fontSize: 17, lineHeight: 26, color: colors.textPrimary },
  context: { ...textStyles.small, color: colors.textMuted },
});
