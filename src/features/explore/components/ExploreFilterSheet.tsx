import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { Button, Toggle } from '@/components/ui';
import type { ExploreFilterId } from '@/services/explore/filters';
import { colors, radii, spacing, typography } from '@/theme';

type ExploreFilterSheetProps = {
  visible: boolean;
  activeFilters: ExploreFilterId[];
  onApply: (filters: ExploreFilterId[]) => void;
  onClose: () => void;
};

const FILTER_IDS: ExploreFilterId[] = ['regions', 'nature', 'discovered', 'undiscovered'];

/** Only real, honest filter options - Regions/Nature (real explore_regions
 * kinds) and Discovered/Undiscovered (real per-user visited state). No
 * Animals/Culture/Food/Places filters, since none of those catalogs exist
 * yet (see the Explore 2.0 plan's audit section). */
export function ExploreFilterSheet({ visible, activeFilters, onApply, onClose }: ExploreFilterSheetProps) {
  const { t } = useTranslation();
  const [local, setLocal] = useState<ExploreFilterId[]>(activeFilters);

  useEffect(() => {
    if (visible) setLocal(activeFilters);
  }, [visible, activeFilters]);

  function toggle(id: ExploreFilterId) {
    setLocal((current) => (current.includes(id) ? current.filter((f) => f !== id) : [...current, id]));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <OymoOrnament size={14} color={colors.accentGold} strokeWidth={1.5} />
            <Text style={styles.title}>{t('explore.filters.title')}</Text>
          </View>

          {FILTER_IDS.map((id, index) => (
            <View key={id} style={[styles.row, index === FILTER_IDS.length - 1 && styles.rowLast]}>
              <Text style={styles.rowLabel}>{t(`explore.filters.options.${id}`)}</Text>
              <Toggle value={local.includes(id)} onValueChange={() => toggle(id)} accessibilityLabel={t(`explore.filters.options.${id}`)} />
            </View>
          ))}

          <View style={styles.actions}>
            <View style={styles.actionItem}>
              <Button label={t('explore.filters.clear')} variant="secondary" onPress={() => setLocal([])} />
            </View>
            <View style={styles.actionItem}>
              <Button label={t('explore.filters.apply')} onPress={() => onApply(local)} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,14,8,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceBorder,
    marginBottom: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionItem: {
    flex: 1,
    alignItems: 'stretch',
  },
});
