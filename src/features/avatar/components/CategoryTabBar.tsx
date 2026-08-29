import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

import { AVATAR_TABS } from '../data';
import type { AvatarTabId } from '../types';

type CategoryTabBarProps = {
  activeTabId: AvatarTabId;
  onSelectTab: (tabId: AvatarTabId) => void;
};

/** Horizontal category strip - active tab uses OYNO's dark forest green,
 * never the bright blue a Duolingo-style reference would use. */
export function CategoryTabBar({ activeTabId, onSelectTab }: CategoryTabBarProps) {
  const { t } = useTranslation();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
      {AVATAR_TABS.map((tab) => {
        const isActive = tab.id === activeTabId;
        const Icon = tab.icon;
        return (
          <AnimatedPressable
            key={tab.id}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onSelectTab(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={t(tab.labelKey)}
          >
            <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
              <Icon size={18} color={isActive ? colors.textOnPrimary : colors.primary} strokeWidth={1.75} />
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
              {t(tab.labelKey)}
            </Text>
          </AnimatedPressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  tab: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.lg,
    minWidth: 64,
  },
  tabActive: {
    backgroundColor: colors.surfaceAlt,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: {
    ...typography.small,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
