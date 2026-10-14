import { Copy, RotateCw, Trash2, ZoomIn, ZoomOut } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, iconSizes, radii, spacing, text } from '@/theme';

type TransformToolbarProps = {
  onRotate: () => void;
  onScaleUp: () => void;
  onScaleDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

/** Shown only while a layer is selected. Stepped tap actions instead of
 * corner drag-handles - matches the tap-over-drag precedent from V1's Boz
 * Üy builder (see the V2 plan for why), and stays accessible without any
 * new gesture wiring. */
export function TransformToolbar({ onRotate, onScaleUp, onScaleDown, onDuplicate, onDelete }: TransformToolbarProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <Action icon={RotateCw} label={t('culture.oymo.transform.rotate')} onPress={onRotate} />
      <Action icon={ZoomIn} label={t('culture.oymo.transform.scaleUp')} onPress={onScaleUp} />
      <Action icon={ZoomOut} label={t('culture.oymo.transform.scaleDown')} onPress={onScaleDown} />
      <Action icon={Copy} label={t('culture.oymo.transform.duplicate')} onPress={onDuplicate} />
      <Action icon={Trash2} label={t('culture.oymo.transform.delete')} onPress={onDelete} tone="danger" />
    </View>
  );
}

function Action({
  icon: Icon,
  label,
  onPress,
  tone = 'default',
}: {
  icon: typeof RotateCw;
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <AnimatedPressable style={styles.action} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Icon size={iconSizes.md} color={tone === 'danger' ? colors.dangerText : colors.primary} strokeWidth={2.25} />
      <Text style={[styles.label, tone === 'danger' && styles.labelDanger]} numberOfLines={1}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  action: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    minWidth: 56,
  },
  label: {
    ...text.fine,
    color: colors.textPrimary,
  },
  labelDanger: {
    color: colors.dangerText,
  },
});
