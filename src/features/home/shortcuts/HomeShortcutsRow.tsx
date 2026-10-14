import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { BookOpen, Gamepad2, Headphones, Palette, Pencil, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { SectionError } from '@/components/state/ScreenState';
import { AnimatedPressable, Skeleton, TextButton } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { isRouteAvailableOffline } from '@/services/offline/offlineAvailability';
import { ownerShortcuts, useHomeShortcutsStore } from '@/store/useHomeShortcutsStore';
import { cardRadii, colors, headings, iconSizes, spacing, text } from '@/theme';

import type { Interest } from '../chooser/activityChooser';
import { MAX_PINS, pinsOf, resolvePins } from './shortcutsModel';

export const SHORTCUTS_EDIT_ROUTE = '/settings/home-shortcuts';
const ICONS: Record<Interest, LucideIcon> = { discover: BookOpen, play: Gamepad2, create: Palette, listen: Headphones };

/** Home: the current owner's pinned shortcuts (or the default four), with Edit. */
export function HomeShortcutsRow() {
  const { t } = useTranslation();
  const owner = useRecordsOwner();
  const status = useHomeShortcutsStore((state) => state.status);
  const saved = useHomeShortcutsStore((state) => state.saved);
  const queryClient = useQueryClient();
  const { isOffline } = useNetworkStatus();
  useEffect(() => {
    void useHomeShortcutsStore.getState().load();
  }, []);

  const { shown, unavailableIds } = resolvePins(pinsOf(ownerShortcuts(saved, owner)), (route) => !isOffline || isRouteAvailableOffline(route, queryClient));

  return (
    <View style={styles.root} testID="home-shortcuts">
      <View style={styles.headerRow}>
        <Text style={styles.heading} accessibilityRole="header">
          {t('homeShortcuts.title')}
        </Text>
        <TextButton label={t('homeShortcuts.edit')} trailingIcon={<Pencil size={iconSizes.xs} color={colors.primary} strokeWidth={2.25} />} onPress={() => router.push(SHORTCUTS_EDIT_ROUTE as never)} testID="home-shortcuts-edit" />
      </View>
      {status === 'error' ? (
        <SectionError message={t('homeShortcuts.loadError')} onRetry={() => void useHomeShortcutsStore.getState().retryLoad()} testID="home-shortcuts-error" />
      ) : status !== 'ready' ? (
        // The same grid shape that will appear (four tiles), not a spinner.
        <View style={styles.grid} accessibilityLabel={t('homeShortcuts.loading')} accessible>
          {Array.from({ length: MAX_PINS }, (_, index) => (
            <View key={index} style={styles.itemSkeleton}>
              <Skeleton height={48} borderRadius={cardRadii.compact} />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.grid}>
          {shown.map(({ activity, available }) => {
            const Icon = ICONS[activity.interest];
            const title = activity.title ?? t(activity.titleKey!);
            return (
              <AnimatedPressable
                key={activity.id}
                style={[styles.item, !available && styles.itemOff]}
                onPress={() => (available ? router.push(activity.route as never) : undefined)}
                press="soft"
                accessibilityRole="button"
                accessibilityLabel={available ? title : `${title}. ${t('homeShortcuts.needsConnection')}`}
                accessibilityState={{ disabled: !available }}
                testID={`home-shortcut-${activity.id}`}
              >
                <Icon size={iconSizes.md} color={available ? colors.primary : colors.textSecondary} strokeWidth={2} />
                <View style={styles.flex}>
                  <Text style={styles.label}>{title}</Text>
                  {!available ? <Text style={styles.meta}>{t('homeShortcuts.needsConnection')}</Text> : null}
                </View>
              </AnimatedPressable>
            );
          })}
          {shown.length === 0 ? <Text style={styles.meta}>{t('homeShortcuts.none')}</Text> : null}
        </View>
      )}
      {status === 'ready' && unavailableIds.length > 0 ? (
        <Text style={styles.meta} testID="home-shortcuts-unavailable">
          {t('homeShortcuts.unavailable', { count: unavailableIds.length })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heading: { ...headings.label, color: colors.textSecondary, flexShrink: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  item: { flexGrow: 1, flexBasis: 140, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 48, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  itemOff: { backgroundColor: colors.surfaceMuted },
  itemSkeleton: { flexGrow: 1, flexBasis: 140 },
  flex: { flex: 1 },
  label: { ...text.emphasis, color: colors.textPrimary },
  meta: { ...text.fine, color: colors.textSecondary },
});
