import { Check, CloudDownload } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, textStyles } from '@/theme';

/**
 * Small status mark for photography. Two states that must never be
 * confused, so they differ in colour, icon AND text:
 *   visited  gold seal + check  ("Visited")  - a Passport stamp exists
 *   offline  dark glass + cloud ("Offline")  - a local copy exists
 */
export function PhotoBadge({ kind, label }: { kind: 'visited' | 'offline'; label: string }) {
  const visited = kind === 'visited';
  const Icon = visited ? Check : CloudDownload;
  return (
    <View style={[styles.badge, visited ? styles.visited : styles.offline]} accessible accessibilityLabel={label}>
      <Icon size={11} color={visited ? colors.textPrimary : colors.textOnDark} strokeWidth={3} />
      <Text style={[styles.text, { color: visited ? colors.textPrimary : colors.textOnDark }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  visited: { backgroundColor: colors.accentGold },
  offline: { backgroundColor: colors.chipOnDark },
  text: { ...textStyles.small, fontSize: 11 },
});
