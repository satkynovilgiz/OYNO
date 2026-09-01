import { Plus, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, IconButton } from '@/components/ui';
import type { OymoCreationRow } from '@/services/content/oymoCreationsService';
import { colors, radii, spacing, typography } from '@/theme';

import { OymoMiniPreview } from './OymoMiniPreview';

type SavedPatternsGalleryProps = {
  creations: OymoCreationRow[];
  onLoad: (creation: OymoCreationRow) => void;
  onDelete: (creation: OymoCreationRow) => void;
  onNew: () => void;
};

export function SavedPatternsGallery({ creations, onLoad, onDelete, onNew }: SavedPatternsGalleryProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{t('culture.oymo.gallery.title')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {creations.map((creation) => (
          <View key={creation.id} style={styles.tile}>
            <AnimatedPressable
              onPress={() => onLoad(creation)}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel={creation.name}
            >
              <OymoMiniPreview layers={creation.layers} backgroundColor={creation.background_color} symmetryMode={creation.symmetry_mode} />
            </AnimatedPressable>
            <Text style={styles.name} numberOfLines={1}>
              {creation.name}
            </Text>
            <View style={styles.deleteButton}>
              <IconButton icon={Trash2} size={24} iconSize={12} accessibilityLabel={t('culture.oymo.gallery.delete')} onPress={() => onDelete(creation)} />
            </View>
          </View>
        ))}

        <AnimatedPressable style={styles.newTile} onPress={onNew} haptic="light" accessibilityRole="button" accessibilityLabel={t('culture.oymo.gallery.new')}>
          <Plus size={24} color={colors.primary} strokeWidth={2.25} />
          <Text style={styles.newLabel}>{t('culture.oymo.gallery.new')}</Text>
        </AnimatedPressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  row: {
    gap: spacing.sm,
  },
  tile: {
    width: 72,
    gap: 2,
  },
  deleteButton: {
    position: 'absolute',
    top: -6,
    right: -6,
  },
  name: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  newTile: {
    width: 72,
    height: 72,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  newLabel: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '700',
  },
});
