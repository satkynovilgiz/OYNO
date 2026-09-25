import { Map as MapIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

/**
 * The map entry: the existing live KyrgyzstanMap preview (its own pins,
 * filter and locate controls untouched) sitting on one card with a footer
 * that carries the real Passport count and the Open map action.
 */
export function ExploreMapCard({ map, visited, total, onPressOpen }: { map: ReactNode; visited: number; total: number; onPressOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card} accessibilityLabel={t('explore.v2.mapTitle')}>
      {map}
      <View style={styles.footer}>
        <View style={styles.icon}>
          <MapIcon size={18} color={colors.primary} strokeWidth={2.25} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={2}>
            {t('explore.map.summary', { unlocked: visited, total })}
          </Text>
        </View>
        <Button label={t('explore.v2.openMap')} size="sm" variant="primary" onPress={onPressOpen} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.md, padding: 6, gap: 6, borderRadius: cardRadii.hero, backgroundColor: colors.surfaceElevated },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  text: { flex: 1, minWidth: 0 },
  title: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
});
