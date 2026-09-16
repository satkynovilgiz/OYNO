import { type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { colors, radii } from '@/theme';

type IconChipShape = 'roundedSquare' | 'circle';

type IconChipProps = {
  icon: LucideIcon;
  size?: number;
  iconSize?: number;
  color?: string;
  shape?: IconChipShape;
  /** Soft tint background derived from `color` instead of the flat
   * `surfaceAlt` default - the "each stat gets its own colored roundel"
   * pattern (currency rows, category icons). */
  tinted?: boolean;
};

/** Single shared "icon in a container" primitive for card leading icons,
 * list-row icons, and colored stat roundels (Section "Create consistent
 * icon containers for XP, coins, streak, achievements, quests,
 * discoveries, games, culture, profile actions and rewards") - replaces
 * the several near-identical `iconWrap` styles that used to be
 * hand-rolled per screen. */
export function IconChip({ icon: Icon, size = 44, iconSize, color = colors.accentBrown, shape = 'roundedSquare', tinted = false }: IconChipProps) {
  return (
    <View
      style={[
        styles.chip,
        {
          width: size,
          height: size,
          borderRadius: shape === 'circle' ? size / 2 : radii.lg,
          backgroundColor: tinted ? `${color}1F` : colors.surfaceAlt,
        },
      ]}
    >
      <Icon size={iconSize ?? Math.round(size * 0.45)} color={color} strokeWidth={1.75} />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
