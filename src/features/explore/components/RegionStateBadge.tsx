import { Check, CircleDot, Lock, Star } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

import type { RegionState } from '@/services/explore/regionState';

type RegionStateBadgeProps = {
  state: RegionState;
};

/** Small icon-shaped overlay at each map pin communicating region state by
 * shape, not just color (lock/dot/check/star), matching "state differentiation
 * must not rely on color alone". Nothing renders for 'available' - the
 * baked pin dot itself is already the "not yet visited" default look. */
export function RegionStateBadge({ state }: RegionStateBadgeProps) {
  if (state === 'available') return null;

  const { Icon, background } = BADGE_BY_STATE[state];

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Icon size={10} color={colors.textOnDark} strokeWidth={3} fill={state === 'completed' ? colors.textOnDark : 'none'} />
    </View>
  );
}

const BADGE_BY_STATE: Record<Exclude<RegionState, 'available'>, { Icon: typeof Lock; background: string }> = {
  locked: { Icon: Lock, background: colors.textSecondary },
  started: { Icon: CircleDot, background: colors.primary },
  explored: { Icon: Check, background: colors.discovery.nature },
  completed: { Icon: Star, background: colors.accentGold },
};

const styles = StyleSheet.create({
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
});
