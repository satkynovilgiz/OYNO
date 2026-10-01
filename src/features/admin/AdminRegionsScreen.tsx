import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, IconButton } from '@/components/ui';
import { useRegionExperiences } from '@/features/explore/regions/useRegionExperiences';
import { useRegionLinks } from '@/services/content/regionLinksService';
import { useExploreRegions } from '@/services/content/exploreService';
import { colors, radii, shadows, spacing, typography } from '@/theme';

/** /admin/regions - the 7 supported regions in their fixed order, each with
 * its linked-content counts and whether an editor has curated it yet.
 * English only, like the rest of the admin tools. */
export function AdminRegionsScreen({ onPressBack, onPressRegion }: { onPressBack: () => void; onPressRegion: (id: string) => void }) {
  const insets = useSafeAreaInsets();
  const configs = useRegionExperiences();
  const { data: links, error: linksError } = useRegionLinks();
  const { data: rows } = useExploreRegions();

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel="Back" onPress={onPressBack} />
        <Text style={styles.title}>Regions</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Text style={styles.note}>
          Choose which existing content each Region Hub shows. Region order, heroes, challenge packs and progress rules stay in the app. A region nobody has curated uses its built-in links.
        </Text>
        {linksError ? <Text style={styles.error}>Couldn't load curated links - showing built-in links.</Text> : null}
        {configs.map((config) => {
          const row = rows?.find((candidate) => candidate.id === config.id);
          const curated = (links ?? []).some((link) => link.region_id === config.id);
          const counts = `${config.destinationIds.length} places · ${config.discoveryIds.length} discoveries · ${config.cultureItemIds.length + config.materialIds.length} culture · ${config.trailIds.length + config.questIds.length} trails/quests`;
          return (
            <AnimatedPressable key={config.id} style={styles.row} onPress={() => onPressRegion(config.id)} accessibilityRole="button" accessibilityLabel={`${row?.name_en ?? config.id}. ${curated ? 'Curated' : 'Built-in links'}. ${counts}`}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowLabel}>{row?.name_en ?? config.id}</Text>
                <Text style={styles.meta}>{counts}</Text>
                <Text style={[styles.badge, curated && styles.badgeCurated]}>{curated ? 'Curated' : 'Built-in links'}</Text>
              </View>
              <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2} />
            </AnimatedPressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary },
  content: { paddingHorizontal: spacing.md, gap: spacing.sm },
  note: { ...typography.caption, color: colors.textSecondary },
  error: { ...typography.caption, color: colors.error },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.surfaceBorder, ...shadows.card },
  rowLabel: { ...typography.bodyBold, color: colors.textPrimary },
  meta: { ...typography.small, color: colors.textSecondary },
  badge: { ...typography.small, alignSelf: 'flex-start', color: colors.textMuted },
  badgeCurated: { color: colors.primary, fontWeight: '700' },
});
