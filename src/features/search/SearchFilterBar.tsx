import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { NO_FILTERS, type SearchFilters, type SearchResultGroup } from '@/services/search/globalSearch';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

type Props = {
  counts: { id: SearchResultGroup; count: number }[];
  total: number;
  filters: SearchFilters;
  compact: boolean;
  large: boolean;
  /** Saved / offline toggles (hidden for children - fewer filters). */
  showStateFilters: boolean;
  onChange: (filters: SearchFilters) => void;
};

/** Compact filters over the CURRENT results: one group at a time (the
 * existing search groups, with live counts) plus Saved only / Available
 * offline. Selected state is announced, not shown by colour alone. */
export function SearchFilterBar({ counts, total, filters, compact, large, showStateFilters, onChange }: Props) {
  const { t } = useTranslation();
  const active = filters.group !== 'all' || filters.savedOnly || filters.offlineOnly;
  const groupChip = (id: 'all' | SearchResultGroup, count: number) => {
    const selected = filters.group === id;
    const label = id === 'all' ? t('search.filters.all') : t(`search.filters.groups.${id}`);
    return (
      <AnimatedPressable
        key={id}
        style={[styles.chip, compact && styles.chipCompact, large && styles.chipLarge, selected && styles.chipOn]}
        onPress={() => onChange({ ...filters, group: id })}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        aria-checked={selected}
        accessibilityLabel={t('search.filters.chipLabel', { name: label, count })}
      >
        {selected ? <Check size={12} color={colors.textOnDark} strokeWidth={3} /> : null}
        <Text style={[styles.chipText, large && styles.chipTextLarge, selected && styles.chipTextOn]}>
          {label} {count}
        </Text>
      </AnimatedPressable>
    );
  };
  const toggle = (key: 'savedOnly' | 'offlineOnly', label: string) => {
    const on = filters[key];
    return (
      <AnimatedPressable
        key={key}
        style={[styles.chip, compact && styles.chipCompact, on && styles.chipOn]}
        onPress={() => onChange({ ...filters, [key]: !on })}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        aria-checked={on}
        accessibilityLabel={label}
      >
        {on ? <Check size={12} color={colors.textOnDark} strokeWidth={3} /> : null}
        <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
      </AnimatedPressable>
    );
  };
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t('search.filters.groupLabel')}>
        {groupChip('all', total)}
        {counts.map((entry) => groupChip(entry.id, entry.count))}
      </ScrollView>
      {showStateFilters ? (
        <View style={styles.row}>
          {toggle('savedOnly', t('search.filters.savedOnly'))}
          {toggle('offlineOnly', t('search.filters.offlineOnly'))}
          {active ? (
            <AnimatedPressable style={styles.clear} onPress={() => onChange(NO_FILTERS)} accessibilityRole="button" accessibilityLabel={t('search.filters.clear')}>
              <Text style={styles.clearText}>{t('search.filters.clear')}</Text>
            </AnimatedPressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'nowrap', gap: spacing.xs, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: spacing.sm, borderRadius: cardRadii.chip, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  chipCompact: { minHeight: 32 },
  chipLarge: { minHeight: 44, paddingHorizontal: spacing.md },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.caption, fontWeight: '700', color: colors.textPrimary },
  chipTextLarge: { fontSize: 16 },
  chipTextOn: { color: colors.textOnDark },
  clear: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.xs },
  clearText: { ...textStyles.caption, fontWeight: '700', color: colors.primary },
});
