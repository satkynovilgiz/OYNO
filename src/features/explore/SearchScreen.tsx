import { ChevronLeft, Search as SearchIcon, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, IconButton } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { track } from '@/services/analytics/analytics';
import { useDiscoveries } from '@/services/content/discoveriesService';
import { useExploreRegions } from '@/services/content/exploreService';
import { mapDiscoveryTitle, mapExploreRegionName } from '@/services/content/types';
import { groupSearchResults, searchExploreContent, type SearchItem } from '@/services/explore/search';
import { colors, radii, spacing, typography } from '@/theme';

type SearchScreenProps = {
  onPressBack: () => void;
  onPressResult: (item: SearchItem) => void;
};

export function SearchScreen({ onPressBack, onPressResult }: SearchScreenProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const { data: regions } = useExploreRegions();
  const { data: discoveries } = useDiscoveries();

  const items = useMemo<SearchItem[]>(() => {
    const regionItems: SearchItem[] = (regions ?? []).map((row) => ({
      id: row.id,
      kind: row.kind === 'nature' ? 'nature' : 'region',
      names: mapExploreRegionName(row),
    }));
    const discoveryItems: SearchItem[] = (discoveries ?? []).map((row) => ({
      id: row.id,
      kind: 'discovery',
      names: mapDiscoveryTitle(row),
    }));
    return [...regionItems, ...discoveryItems];
  }, [regions, discoveries]);

  const results = searchExploreContent(items, query);
  const grouped = groupSearchResults(results);
  const language = i18n.language as SupportedLanguage;

  function handleSubmit() {
    if (query.trim()) track('explore_search', { query: query.trim() });
  }

  const sections: { key: 'region' | 'nature' | 'discovery'; titleKey: string; items: SearchItem[] }[] = [
    { key: 'region', titleKey: 'explore.search.sectionRegions', items: grouped.region },
    { key: 'nature', titleKey: 'explore.search.sectionNature', items: grouped.nature },
    { key: 'discovery', titleKey: 'explore.search.sectionDiscoveries', items: grouped.discovery },
  ];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <View style={styles.inputRow}>
          <SearchIcon size={18} color={colors.textSecondary} strokeWidth={2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSubmit}
            placeholder={t('explore.search.placeholder')}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoFocus
            accessibilityLabel={t('explore.header.searchLabel')}
          />
          {query.length > 0 && (
            <AnimatedPressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel={t('common.cancel')}>
              <X size={18} color={colors.textSecondary} strokeWidth={2} />
            </AnimatedPressable>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {query.trim().length === 0 ? null : results.length === 0 ? (
          <Text style={styles.emptyText}>{t('explore.search.emptyState')}</Text>
        ) : (
          sections
            .filter((section) => section.items.length > 0)
            .map((section) => (
              <View key={section.key} style={styles.section}>
                <Text style={styles.sectionTitle}>{t(section.titleKey)}</Text>
                {section.items.map((item) => (
                  <AnimatedPressable
                    key={item.id}
                    style={styles.row}
                    onPress={() => onPressResult(item)}
                    accessibilityRole="button"
                    accessibilityLabel={item.names[language] ?? item.names.kg}
                  >
                    <Text style={styles.rowLabel}>{item.names[language] ?? item.names.kg}</Text>
                  </AnimatedPressable>
                ))}
              </View>
            ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  inputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.sm,
    height: 44,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
  },
  content: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  row: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  rowLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
});
