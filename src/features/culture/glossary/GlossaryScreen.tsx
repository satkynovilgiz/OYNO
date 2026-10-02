import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Search as SearchIcon } from 'lucide-react-native';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';
import { AnimatedPressable, IconButton } from '@/components/ui';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { cardRadii, colors, editorial, spacing, textStyles, typography } from '@/theme';

import { glossaryRoute } from './glossaryData';
import { previewOf, searchGlossary } from './glossaryModel';
import { useGlossary } from './useGlossary';

/** /culture/glossary - a small curated glossary of Kyrgyz cultural terms,
 * each defined by an existing authored OYNO field (never generated). */
export function GlossaryScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';
  const { entries, isLoading, waitingForNetwork, retry } = useGlossary();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const shown = searchGlossary(entries, deferred);

  if (waitingForNetwork) return <OfflineUnavailable onRetry={retry} />;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={[styles.title, isAdult && styles.titleEditorial]} accessibilityRole="header" numberOfLines={1}>
          {t('glossary.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{t('glossary.intro')}</Text>
        <View style={styles.field}>
          <SearchIcon size={16} color={colors.textSecondary} strokeWidth={2.25} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder={t('glossary.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityRole="search"
            accessibilityLabel={t('glossary.searchLabel')}
          />
        </View>
        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {!isLoading && shown.length === 0 ? <Text style={styles.empty}>{t('glossary.noResults')}</Text> : null}
        {shown.map(({ entry, item, definition }) => (
          <AnimatedPressable
            key={entry.id}
            style={[styles.row, isChild && styles.rowChild]}
            onPress={() => router.push(glossaryRoute(entry.id) as never)}
            accessibilityRole="button"
            accessibilityLabel={`${entry.term}. ${t('glossary.termA11y')}.`}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.term, isChild && styles.termChild, isAdult && styles.termEditorial]}>{entry.term}</Text>
              <Text style={styles.preview} numberOfLines={isChild ? 2 : 3}>
                {previewOf(definition)}
              </Text>
              {!isChild ? <Text style={styles.context}>{t('glossary.from', { title: item.title })}</Text> : null}
            </View>
            <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
          </AnimatedPressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  titleEditorial: { ...editorial(typography.h1) },
  content: { paddingHorizontal: spacing.md, gap: spacing.sm },
  intro: { ...textStyles.small, color: colors.textSecondary },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: cardRadii.chip, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  input: { flex: 1, ...textStyles.body, color: colors.textPrimary },
  empty: { ...textStyles.body, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  rowChild: { paddingVertical: spacing.lg },
  term: { ...textStyles.title, color: colors.textPrimary },
  termChild: { fontSize: 22, lineHeight: 28 },
  termEditorial: { ...editorial(textStyles.title) },
  preview: { ...textStyles.small, color: colors.textSecondary },
  context: { ...typography.overline, fontSize: 10, color: colors.accentTerracotta },
});
