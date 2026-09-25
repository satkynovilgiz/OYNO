import { Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, Chip } from '@/components/ui';
import { collections } from '@/features/collections/collectionsData';
import { cultureItemImages } from '@/features/culture/data';
import { natureSiteImages } from '@/features/explore/data';
import { trails } from '@/features/trails/trailsData';
import type { SupportedLanguage } from '@/i18n';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useExploreRegions } from '@/services/content/exploreService';
import { mapExploreRegionName } from '@/services/content/types';
import { normalizeSearchQuery } from '@/services/search/globalSearch';
import { cardRadii, colors, elevation, radii, spacing, textStyles } from '@/theme';

import { rememberCultureItemId, type JournalLink, type JournalLinkType } from './journalModel';

type Option = JournalLink & { thumbnail: ImageSourcePropType | null; haystack: string };

const TYPES: JournalLinkType[] = ['nature_site', 'culture_item', 'collection', 'trail'];

/**
 * Pick the OYNO content a memory is about - a simple searchable list of
 * the existing catalog (nature sites, culture items, collections, trails).
 * Plain local filtering of already-loaded data, not a second search engine.
 */
export function LinkContentSheet({ visible, onPick, onClose }: { visible: boolean; onPick: (link: JournalLink) => void; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { data: regions } = useExploreRegions();
  const { data: items } = useAllCultureItems();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<JournalLinkType>('nature_site');

  const options = useMemo<Option[]>(() => {
    const localized = (text: { kg: string; ru: string; en: string }) => text[language] ?? text.kg;
    const all: Option[] = [
      ...(regions ?? [])
        .filter((row) => row.kind === 'nature')
        .map((row) => {
          const names = mapExploreRegionName(row);
          return { type: 'nature_site' as const, id: row.id, label: names[language] ?? names.kg, thumbnail: natureSiteImages[row.id] ?? null, haystack: `${names.kg} ${names.ru} ${names.en}` };
        }),
      ...(items ?? []).map((row) => ({ type: 'culture_item' as const, id: row.id, label: row.title, thumbnail: cultureItemImages[row.id]?.[0] ?? null, haystack: `${row.title} ${row.alt_names ?? ''}` })),
      ...collections.map((row) => ({ type: 'collection' as const, id: row.id, label: localized(row.title), thumbnail: row.heroImage, haystack: `${row.title.kg} ${row.title.ru} ${row.title.en}` })),
      ...trails.map((row) => ({ type: 'trail' as const, id: row.id, label: localized(row.title), thumbnail: row.heroImage, haystack: `${row.title.kg} ${row.title.ru} ${row.title.en}` })),
    ];
    return all;
  }, [regions, items, language]);

  const normalized = normalizeSearchQuery(query);
  const shown = options.filter((option) => (normalized ? normalizeSearchQuery(option.haystack).includes(normalized) : option.type === type));

  return (
    <Modal visible={visible} transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('journal.cancel')} />
      <View style={[styles.sheet, elevation.floating, { paddingBottom: insets.bottom + spacing.sm }]} accessibilityViewIsModal>
        <View style={styles.handle} />
        <Text style={styles.title} accessibilityRole="header">
          {t('journal.v2.linkPickerTitle')}
        </Text>
        <View style={styles.search}>
          <Search size={16} color={colors.textMuted} strokeWidth={2.25} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('journal.v2.linkSearch')}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCorrect={false}
            accessibilityLabel={t('journal.v2.linkSearch')}
          />
        </View>
        {normalized ? null : (
          <View style={styles.types}>
            {TYPES.map((option) => (
              <Chip key={option} label={t(`journal.linkTypes.${option}`)} selected={option === type} onPress={() => setType(option)} accessibilityRole="tab" />
            ))}
          </View>
        )}
        <FlatList
          data={shown}
          keyExtractor={(option) => `${option.type}:${option.id}`}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.empty}>{t('journal.v2.linkNone')}</Text>}
          renderItem={({ item }) => (
            <AnimatedPressable
              style={styles.row}
              onPress={() => {
                // Came from the live catalog, so it's real (same rule as opening its detail screen).
                if (item.type === 'culture_item') rememberCultureItemId(item.id);
                onPick({ type: item.type, id: item.id, label: item.label });
              }}
              press="soft"
              accessibilityRole="button"
              accessibilityLabel={`${t(`journal.linkTypes.${item.type}`)}: ${item.label}`}
            >
              {item.thumbnail ? (
                <Image source={item.thumbnail} style={styles.thumb} resizeMode="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <OymoOrnament size={14} color={colors.accentGold} strokeWidth={1.5} />
                </View>
              )}
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {item.label}
                </Text>
                <Text style={styles.rowType}>{t(`journal.linkTypes.${item.type}`)}</Text>
              </View>
            </AnimatedPressable>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(19,32,24,0.5)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '78%', paddingTop: spacing.xs, paddingHorizontal: spacing.md, gap: spacing.sm, borderTopLeftRadius: cardRadii.hero, borderTopRightRadius: cardRadii.hero, backgroundColor: colors.background },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderSubtle },
  title: { ...textStyles.title, color: colors.textPrimary, textAlign: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.surfaceElevated },
  input: { flex: 1, ...textStyles.body, color: colors.textPrimary, paddingVertical: 0 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  list: { flex: 1 },
  empty: { ...textStyles.body, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  thumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.surfaceMuted },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  rowType: { ...textStyles.small, color: colors.textMuted },
});
