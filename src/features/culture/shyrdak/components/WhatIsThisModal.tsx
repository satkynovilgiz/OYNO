import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { useCultureItem } from '@/services/content/cultureItemsService';
import type { CultureItemRow } from '@/services/content/types';
import { colors, radii, spacing, typography } from '@/theme';

type WhatIsThisModalProps = {
  visible: boolean;
  onClose: () => void;
};

const FIELDS: { key: keyof CultureItemRow; labelKey: string }[] = [
  { key: 'origin', labelKey: 'culture.item.originLabel' },
  { key: 'history', labelKey: 'culture.item.historyLabel' },
  { key: 'traditional_method', labelKey: 'culture.item.traditionalMethodLabel' },
  { key: 'modern_status', labelKey: 'culture.item.modernStatusLabel' },
  { key: 'fun_facts', labelKey: 'culture.item.funFactsLabel' },
];

/** Shows the real, already-verified `shyrdak-craft` culture_items content
 * (V1's audit found this already sourced/cited - no new research needed
 * here). Reuses the same field-list pattern as CultureItemDetailScreen. */
export function WhatIsThisModal({ visible, onClose }: WhatIsThisModalProps) {
  const { t } = useTranslation();
  const { data: item, isLoading } = useCultureItem('shyrdak-craft');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{item?.title ?? t('culture.shyrdak.whatIsThis')}</Text>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <View style={styles.fields}>
                {FIELDS.filter((field) => item && item[field.key]).map((field) => (
                  <View key={field.key} style={styles.field}>
                    <Text style={styles.fieldLabel}>{t(field.labelKey)}</Text>
                    <Text style={styles.fieldValue}>{item![field.key] as string}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
          <Button label={t('culture.bozUy.tipsModal.close')} onPress={onClose} />
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
    maxHeight: '80%',
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  scroll: {
    maxHeight: 360,
  },
  fields: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.xxs,
  },
  fieldLabel: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  fieldValue: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 21,
  },
});
