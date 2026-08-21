import { Landmark } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AnimatedPressable } from '@/components/ui';
import { colors, typography } from '@/theme';

import type { MapPinVariant } from '../types';

type MapPinProps = {
  label: string;
  color: string;
  variant?: MapPinVariant;
  onPress?: () => void;
};

// Classic teardrop marker path in a 24x32 viewBox: a circular head (y 0-24)
// tapering to a point at the bottom (y 32), matching the reference's pins.
const PIN_PATH =
  'M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20c0-6.627-5.373-12-12-12z';

/** A single teardrop marker on KyrgyzstanMap, anchored so its tip points at
 * the target coordinate and its label sits below. "landmark" pins render
 * larger with a building glyph (Бишкек, Ош); others show a plain dot. */
export function MapPin({ label, color, variant = 'default', onPress }: MapPinProps) {
  const isLandmark = variant === 'landmark';
  const width = isLandmark ? 38 : 30;
  const height = (width * 32) / 24;

  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.wrap}
    >
      <View style={{ width, height, marginTop: -height }}>
        <Svg width={width} height={height} viewBox="0 0 24 32">
          <Path d={PIN_PATH} fill={color} stroke={colors.surface} strokeWidth={1} />
          {isLandmark ? null : <Circle cx={12} cy={12} r={4} fill={colors.surface} />}
        </Svg>
        {isLandmark ? (
          <View style={styles.landmarkIcon}>
            <Landmark size={width * 0.4} color={colors.surface} strokeWidth={2.25} />
          </View>
        ) : null}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  landmarkIcon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '75%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.small,
    color: colors.textOnDark,
    fontWeight: '700',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
