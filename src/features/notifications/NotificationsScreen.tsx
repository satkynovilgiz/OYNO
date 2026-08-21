import { ChevronLeft } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, IconButton } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import { mockNotifications } from './data';
import type { AppNotification } from './types';

const CATEGORY_LABELS: Record<AppNotification['category'], string> = {
  rewards: 'Сыйлыктар',
  achievements: 'Жетишкендиктер',
  dailyTasks: 'Күнүмдүк тапшырмалар',
  system: 'Тутум',
  friends: 'Достор',
};

type NotificationsScreenProps = {
  readIds: string[];
  onPressBack?: () => void;
  onPressNotification: (notification: AppNotification) => void;
  onMarkAllAsRead: () => void;
};

export function NotificationsScreen({ readIds, onPressBack, onPressNotification, onMarkAllAsRead }: NotificationsScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel="Артка" onPress={onPressBack} />
        <Text style={styles.title}>Билдирүүлөр</Text>
        <View style={{ width: 44 }} />
      </View>

      <AnimatedPressable
        style={styles.markAllRow}
        onPress={onMarkAllAsRead}
        accessibilityRole="button"
        accessibilityLabel="Баарын окулган деп белгилөө"
      >
        <Text style={styles.markAllText}>Баарын окулган деп белгилөө</Text>
      </AnimatedPressable>

      {mockNotifications.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Жаңы билдирүү жок.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {mockNotifications.map((notification) => {
            const isUnread = !readIds.includes(notification.id);
            return (
              <AnimatedPressable
                key={notification.id}
                style={styles.item}
                onPress={() => onPressNotification(notification)}
                accessibilityRole="button"
                accessibilityLabel={notification.title}
              >
                <View style={styles.iconWrap}>
                  <notification.icon size={20} color={colors.primary} strokeWidth={1.75} />
                  {isUnread ? <View style={styles.unreadDot} /> : null}
                </View>
                <View style={styles.itemBody}>
                  <Text style={styles.category}>{CATEGORY_LABELS[notification.category]}</Text>
                  <Text style={styles.itemTitle}>{notification.title}</Text>
                  <Text style={styles.itemDescription}>{notification.description}</Text>
                  <Text style={styles.itemTime}>{notification.timeLabel}</Text>
                </View>
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  markAllRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'flex-end',
  },
  markAllText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.sm,
    ...shadows.card,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  category: {
    ...typography.overline,
    color: colors.primary,
  },
  itemTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  itemDescription: {
    ...typography.small,
    color: colors.textSecondary,
  },
  itemTime: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
