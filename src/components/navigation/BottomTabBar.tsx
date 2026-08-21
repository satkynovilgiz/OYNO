import { Compass, Home, Swords, UserRound, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

export type TabId = 'home' | 'games' | 'explore' | 'culture' | 'profile';

type TabItem = {
  id: TabId;
  labelKey: string;
  icon: LucideIcon;
};

const TABS: TabItem[] = [
  { id: 'home', labelKey: 'home.nav.home', icon: Home },
  { id: 'games', labelKey: 'home.nav.games', icon: Swords },
  { id: 'explore', labelKey: 'home.nav.explore', icon: Compass },
  { id: 'culture', labelKey: 'home.nav.culture', icon: Home }, // icon overridden below
  { id: 'profile', labelKey: 'home.nav.profile', icon: UserRound },
];

type BottomTabBarProps = {
  activeTab: TabId;
  onPressTab?: (tab: TabId) => void;
};

export function BottomTabBar({ activeTab, onPressTab }: BottomTabBarProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        const color = isActive ? colors.primary : colors.textMuted;
        const Icon = tab.icon;

        return (
          <AnimatedPressable
            key={tab.id}
            style={styles.item}
            pressScale={0.9}
            accessibilityRole="button"
            accessibilityLabel={t(tab.labelKey)}
            onPress={() => onPressTab?.(tab.id)}
          >
            <View style={[styles.highlight, isActive && styles.highlightActive]}>
              {tab.id === 'culture' ? (
                <OymoOrnament size={22} color={color} strokeWidth={1.75} />
              ) : (
                <Icon size={22} color={color} strokeWidth={1.75} />
              )}
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {t(tab.labelKey)}
              </Text>
            </View>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,
    ...shadows.raised,
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  highlight: {
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: 'transparent',
  },
  highlightActive: {
    backgroundColor: colors.surfaceAlt,
  },
  label: {
    ...typography.small,
    fontWeight: '600',
  },
});
