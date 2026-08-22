import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { LocationDetailScreen } from '@/features/explore/LocationDetailScreen';
import type { ExploreLocation } from '@/features/explore/types';
import { track } from '@/services/analytics/analytics';
import { useExploreRegions } from '@/services/content/exploreService';
import { mapExploreRegionName } from '@/services/content/types';
import { colors } from '@/theme';

/** Per-region discovery-progress mock, not wired to a real per-user
 * count yet - see cultureCategoryMockProgress for the same caveat on the
 * Culture side. Matches the placeholder values the design reference used
 * before this screen fetched region content from the database. */
const MOCK_DISCOVERED_PERCENT: Record<string, number> = { 'ysyk-kol': 42 };

export default function ExploreLocationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: regions, isLoading, error } = useExploreRegions();
  const row = regions?.find((item) => item.id === id);

  useEffect(() => {
    if (row) track('location_open', { locationId: row.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Аймак жүктөлгөн жок. Кайра аракет кылыңыз.</Text>
      </View>
    );
  }

  if (!row) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Аймак табылган жок.</Text>
      </View>
    );
  }

  const location: ExploreLocation = {
    id: row.id,
    kind: row.kind,
    name: mapExploreRegionName(row),
    tagline: row.tagline,
    facts: row.facts,
    status: row.status,
    discoveredPercent: MOCK_DISCOVERED_PERCENT[row.id] ?? 0,
  };

  const sameKind = (regions ?? []).filter((item) => item.kind === row.kind);
  const toneIndex = Math.max(
    0,
    sameKind.findIndex((item) => item.id === row.id),
  );

  return <LocationDetailScreen location={location} toneIndex={toneIndex} onPressBack={() => router.back()} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  message: {
    color: colors.textSecondary,
  },
});
