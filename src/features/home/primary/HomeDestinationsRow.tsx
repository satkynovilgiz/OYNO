import { router } from 'expo-router';
import { Gamepad2, Library, Map, Timer, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { HOME_DESTINATIONS, type DestinationId } from './homeDestinations';
import { cardRadii, colors, iconSizes, spacing, textStyles } from '@/theme';

const ICONS: Record<DestinationId, LucideIcon> = {
  games: Gamepad2,
  map: Map,
  activities: Timer,
  shelf: Library,
};

export function HomeDestinations() {
  const { t } = useTranslation();
  return (
    <View style={styles.root} testID="home-destinations">
      <Text style={styles.heading} accessibilityRole="header">
        {t('homePrimary.more')}
      </Text>
      <View style={styles.grid}>
        {HOME_DESTINATIONS.map(({ id, route, titleKey }) => {
          const Icon = ICONS[id];
          return (
            <AnimatedPressable key={id} style={styles.item} onPress={() => router.push(route as never)} press="soft" accessibilityRole="button" accessibilityLabel={t(titleKey)} testID={`home-destination-${id}`}>
              <Icon size={iconSizes.md} color={colors.primary} strokeWidth={2} />
              <Text style={styles.label}>{t(titleKey)}</Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  heading: { ...textStyles.overline, color: colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  item: {
    flexGrow: 1,
    flexBasis: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: cardRadii.compact,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  label: { ...textStyles.bodyMedium, color: colors.textPrimary, flexShrink: 1 },
});
