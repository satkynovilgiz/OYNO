import { ChevronRight, HelpCircle, Lock } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, IconButton, ProgressBar } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import type { ExploreLocation } from '../types';

const TONES = [
  colors.tiles.culture,
  colors.tiles.food,
  colors.tiles.music,
  colors.tiles.map,
];

type LocationCardProps = {
  location: ExploreLocation;
  toneIndex: number;
  onPress?: (location: ExploreLocation) => void;
};

export function LocationCard({ location, toneIndex, onPress }: LocationCardProps) {
  const isDiscovered = location.discoveredPercent > 0;
  const tone = TONES[toneIndex % TONES.length];

  return (
    <AnimatedPressable
      style={styles.pressable}
      onPress={() => !location.locked && onPress?.(location)}
      accessibilityRole="button"
      accessibilityLabel={location.name.kg}
    >
      <View
        style={[
          styles.card,
          { backgroundColor: tone },
          !isDiscovered && !location.locked && styles.undiscovered,
          location.locked && styles.locked,
        ]}
      >
        <View style={styles.content}>
          <View style={styles.textBlock}>
            <Text style={styles.name} numberOfLines={1}>
              {location.name.kg}
            </Text>
            <Text style={styles.tagline} numberOfLines={2}>
              {location.tagline}
            </Text>
          </View>

          {location.locked ? (
            <View style={styles.stateIcon}>
              <Lock size={16} color={colors.textOnDark} strokeWidth={2} />
            </View>
          ) : !isDiscovered ? (
            <View style={styles.stateIcon}>
              <HelpCircle size={16} color={colors.textOnDark} strokeWidth={2} />
            </View>
          ) : (
            <IconButton
              icon={ChevronRight}
              size={30}
              accessibilityLabel={`${location.name.kg} ачуу`}
              onPress={() => onPress?.(location)}
            />
          )}
        </View>

        {isDiscovered && !location.locked ? (
          <View style={styles.progressWrap}>
            <ProgressBar
              progress={location.discoveredPercent / 100}
              height={4}
              trackColor="rgba(255,255,255,0.3)"
              fillColor={colors.textOnDark}
            />
          </View>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '47%',
  },
  card: {
    aspectRatio: 1.3,
    borderRadius: radii.xl,
    justifyContent: 'flex-end',
    padding: spacing.sm,
    gap: spacing.xxs,
    ...shadows.card,
  },
  undiscovered: {
    opacity: 0.55,
  },
  locked: {
    opacity: 0.4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.xxs,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.h2,
    color: colors.textOnDark,
  },
  tagline: {
    ...typography.small,
    color: colors.textOnDark,
    opacity: 0.9,
  },
  stateIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  progressWrap: {
    marginTop: spacing.xxs,
  },
});
