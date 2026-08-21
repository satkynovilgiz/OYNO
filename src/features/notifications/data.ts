import { Award, Gift, Sparkles, Target, TrendingUp } from 'lucide-react-native';

import type { AppNotification } from './types';

/** Mock notification feed - no real backend generates these yet (see
 * PROGRESS_AUDIT.md), so these are realistic examples matching the shared
 * mock data already used elsewhere (Profile's achievements/daily reward),
 * not meant to be literal event history. */
export const mockNotifications: AppNotification[] = [
  {
    id: 'level-up',
    category: 'achievements',
    icon: TrendingUp,
    title: 'Жаңы деңгээл ачылды!',
    description: 'Сиз 12-деңгээлге жетиштиңиз.',
    timeLabel: '2 саат мурун',
  },
  {
    id: 'daily-reward',
    category: 'rewards',
    icon: Gift,
    title: 'Күнүмдүк сыйлык даяр',
    description: '+100 XP жана +50 монета сизди күтүп жатат.',
    timeLabel: '5 саат мурун',
  },
  {
    id: 'first-win-badge',
    category: 'achievements',
    icon: Award,
    title: 'Жаңы жетишкендик: Биринчи жеңиш',
    description: 'Тогуз коргоолдо биринчи жеңишиңизди алдыңыз.',
    timeLabel: 'Кечээ',
  },
  {
    id: 'daily-task',
    category: 'dailyTasks',
    icon: Target,
    title: 'Бүгүнкү тапшырма даяр',
    description: '"Бир жаңы Оймо тап" тапшырмасы сизди күтөт.',
    timeLabel: 'Кечээ',
  },
  {
    id: 'system-update',
    category: 'system',
    icon: Sparkles,
    title: 'OYNO жаңыланды',
    description: 'Жаңы Тогуз коргоол оюну кошулду.',
    timeLabel: '3 күн мурун',
  },
];
