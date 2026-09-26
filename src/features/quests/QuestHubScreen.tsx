import { router } from 'expo-router';
import { Compass } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StoryCompanion } from '@/components/companion/CompanionMoment';
import { LibraryEmptyState, LibraryHeader } from '@/components/library/LibraryChrome';
import { SectionHeader } from '@/components/ui';
import { colors, spacing } from '@/theme';

import { QuestCard } from './QuestCard';
import { groupQuests } from './questProgress';
import { useQuestProgress } from './useQuests';

/** Quests: Continue (the one active quest), Available, Completed. */
export function QuestHubScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { active, available, completed } = groupQuests(useQuestProgress());
  const open = (id: string) => router.push(`/quests/${id}` as never);

  return (
    <View style={styles.root}>
      <LibraryHeader title={t('quests.title')} subtitle={t('quests.subtitle')} onPressBack={onPressBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        {!active && completed.length === 0 && available.length > 0 ? <StoryCompanion surface="emptyQuests" moment="empty" /> : null}
        {active ? (
          <View style={styles.section}>
            <SectionHeader title={t('quests.continueTitle')} size="sm" inset={0} />
            <QuestCard progress={active} large onPress={() => open(active.quest.id)} />
          </View>
        ) : null}
        {available.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title={t('quests.availableTitle')} count={available.length} size="sm" inset={0} />
            {available.map((entry) => (
              <QuestCard key={entry.quest.id} progress={entry} onPress={() => open(entry.quest.id)} />
            ))}
          </View>
        ) : null}
        {completed.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title={t('quests.completedTitle')} count={completed.length} size="sm" inset={0} />
            {completed.map((entry) => (
              <QuestCard key={entry.quest.id} progress={entry} onPress={() => open(entry.quest.id)} />
            ))}
          </View>
        ) : null}
        {!active && available.length === 0 && completed.length === 0 ? <LibraryEmptyState icon={Compass} tone={colors.primary} title={t('quests.emptyTitle')} description={t('quests.emptyBody')} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.md, gap: spacing.lg, paddingTop: spacing.xs },
  section: { gap: spacing.sm },
});
