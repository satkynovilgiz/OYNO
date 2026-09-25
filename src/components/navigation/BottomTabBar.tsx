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
    <View style={styles.bar} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        const color = isActive ? colors.primary : colors.textMuted;
        const Icon = tab.icon;

        return (
          <AnimatedPressable
            key={tab.id}
            style={styles.item}
            press="strong"
            haptic={isActive ? false : 'light'}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={t(tab.labelKey)}
            onPress={() => onPressTab?.(tab.id)}
          >
            <View style={[styles.highlight, isActive && styles.highlightActive]}>
              {tab.id === 'culture' ? (
                <OymoOrnament size={21} color={color} strokeWidth={1.75} />
              ) : (
                <Icon size={21} color={color} strokeWidth={isActive ? 2.25 : 1.75} />
              )}
              <Text
                style={[styles.label, { color }, isActive && styles.labelActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
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
    paddingHorizontal: spacing.xxs,
    ...shadows.raised,
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  highlight: {
    width: '100%',
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xxs,
    paddingHorizontal: 2,
    borderRadius: radii.md,
    backgroundColor: 'transparent',
  },
  highlightActive: {
    backgroundColor: colors.surfaceAlt,
  },
  label: {
    ...typography.small,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  // Same weight family as inactive (700 vs 600) - a heavier active weight
  // pushed long labels like RU "Исследовать" past the tab width.
  labelActive: {
    fontWeight: '700',
  },
});
