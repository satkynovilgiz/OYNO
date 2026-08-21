import type { LucideIcon } from 'lucide-react-native';

export type NotificationCategory = 'rewards' | 'achievements' | 'dailyTasks' | 'system' | 'friends';

export type AppNotification = {
  id: string;
  category: NotificationCategory;
  icon: LucideIcon;
  title: string;
  description: string;
  /** Relative/short time label shown directly (no real clock to compute
   * "3 hours ago" against real send times without a backend). */
  timeLabel: string;
};
