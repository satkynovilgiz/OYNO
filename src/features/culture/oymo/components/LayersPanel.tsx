import { ChevronDown, ChevronUp, Eye, EyeOff, Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, IconButton } from '@/components/ui';
import type { MotifLayer } from '@/services/culture/oymoEditor';
import { colors, radii, spacing, typography } from '@/theme';

import { getMotifShape } from '../motifs';

type LayersPanelProps = {
  layers: MotifLayer[];
  selectedLayerId: string | null;
  backgroundColor: string;
  onSelectLayer: (layerId: string) => void;
  onToggleVisibility: (layerId: string) => void;
  onReorder: (layerId: string, direction: 'up' | 'down') => void;
  onSelectBackground: () => void;
};

/** Ordered layer list - reversed for display (topmost/last-added layer
 * shown first, matching how design tools usually list layers) while the
 * underlying array order stays the real render/z-order. Up/down buttons
 * are the accessible tap alternative to drag-to-reorder (no gesture
 * wiring needed, see the V2 plan). */
export function LayersPanel({
  layers,
  selectedLayerId,
  backgroundColor,
  onSelectLayer,
  onToggleVisibility,
  onReorder,
  onSelectBackground,
}: LayersPanelProps) {
  const { t } = useTranslation();
  const displayLayers = [...layers].reverse();

  return (
    <View style={styles.list}>
      {displayLayers.map((layer, displayIndex) => {
        const Shape = getMotifShape(layer.motifId);
        const isSelected = layer.id === selectedLayerId;
        const isTop = displayIndex === 0;
        const isBottom = displayIndex === displayLayers.length - 1;

        return (
          // A Pressable/button can't legally contain other buttons (invalid
          // HTML on web, real hydration warning) - the row is a plain View;
          // only the select region and each icon button are separately
          // pressable, as siblings rather than nested.
          <View key={layer.id} style={[styles.row, isSelected && styles.rowSelected]}>
            <AnimatedPressable
              style={styles.selectRegion}
              onPress={() => onSelectLayer(layer.id)}
              accessibilityRole="button"
              accessibilityLabel={t('culture.oymo.layers.layerLabel', { index: layers.indexOf(layer) + 1 })}
              accessibilityState={{ selected: isSelected }}
            >
              <View style={styles.thumb}>
                <Shape size={20} color={layer.color} />
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {t('culture.oymo.layers.layerLabel', { index: layers.indexOf(layer) + 1 })}
              </Text>
            </AnimatedPressable>
            <View style={styles.rowActions}>
              <IconButton
                icon={ChevronUp}
                size={28}
                iconSize={14}
                accessibilityLabel={t('culture.oymo.layers.moveUp')}
                onPress={() => onReorder(layer.id, 'up')}
                disabled={isTop}
              />
              <IconButton
                icon={ChevronDown}
                size={28}
                iconSize={14}
                accessibilityLabel={t('culture.oymo.layers.moveDown')}
                onPress={() => onReorder(layer.id, 'down')}
                disabled={isBottom}
              />
              <IconButton
                icon={layer.visible ? Eye : EyeOff}
                size={28}
                iconSize={14}
                accessibilityLabel={t('culture.oymo.layers.toggleVisibility')}
                onPress={() => onToggleVisibility(layer.id)}
              />
            </View>
          </View>
        );
      })}

      <View style={styles.row}>
        <AnimatedPressable style={styles.selectRegion} onPress={onSelectBackground} accessibilityRole="button" accessibilityLabel={t('culture.oymo.layers.background')}>
          <View style={[styles.thumb, { backgroundColor }]} />
          <Text style={styles.name}>{t('culture.oymo.layers.background')}</Text>
        </AnimatedPressable>
        <Lock size={14} color={colors.textMuted} strokeWidth={2.25} style={styles.lockIcon} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.xxs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  rowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  selectRegion: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lockIcon: {
    marginRight: spacing.xxs,
  },
  thumb: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  name: {
    ...typography.small,
    color: colors.textPrimary,
    fontWeight: '700',
    flex: 1,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 2,
  },
});
