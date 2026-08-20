import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

import type { ExploreLocation } from '../types';
import { LocationCard } from './LocationCard';

type LocationsSectionProps = {
  title: string;
  locations: ExploreLocation[];
  onPressLocation?: (location: ExploreLocation) => void;
};

export function LocationsSection({ title, locations, onPressLocation }: LocationsSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.grid}>
        {locations.map((location, index) => (
          <LocationCard
            key={location.id}
            location={location}
            toneIndex={index}
            onPress={onPressLocation}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
});
