import { type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { colors, radii } from '@/theme';

type IconChipProps = {
  icon: LucideIcon;
  size?: number;
  iconSize?: number;
  color?: string;
};

/** Rounded-square beige chip with a centered icon, used for card leading icons. */
export function IconChip({ icon: Icon, size = 44, iconSize, color = colors.accentBrown }: IconChipProps) {
  return (
    <View style={[styles.chip, { width: size, height: size, borderRadius: radii.lg }]}>
      <Icon size={iconSize ?? Math.round(size * 0.45)} color={color} strokeWidth={1.75} />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
