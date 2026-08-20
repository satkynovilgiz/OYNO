import { Compass, Home, Swords, UserRound, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable } from '@/components/ui';
import { colors, shadows, spacing, typography } from '@/theme';

type TabId = 'home' | 'games' | 'explore' | 'culture' | 'profile';

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
  onPressTab?: (tab: TabId) => void;
};

export function BottomTabBar({ onPressTab }: BottomTabBarProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('home');

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
            onPress={() => {
              setActiveTab(tab.id);
              onPressTab?.(tab.id);
            }}
          >
            {tab.id === 'culture' ? (
              <OymoOrnament size={22} color={color} strokeWidth={1.75} />
            ) : (
              <Icon size={22} color={color} strokeWidth={1.75} />
            )}
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {t(tab.labelKey)}
            </Text>
            <View style={[styles.indicator, isActive && styles.indicatorActive]} />
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
    gap: spacing.xxs,
  },
  label: {
    ...typography.small,
    fontWeight: '600',
  },
  indicator: {
    marginTop: 2,
    width: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  indicatorActive: {
    backgroundColor: colors.primary,
  },
});
