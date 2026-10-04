import { CheckCircle2, Circle, Target } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button } from '@/components/ui';
import { track } from '@/services/analytics/analytics';
import { ownerMissions, usePracticeMissionsStore } from '@/store/usePracticeMissionsStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { useRecordsOwner } from '../records/useGameRecords';
import { missionsFor } from './practiceMissions';

/** Which goals the CURRENT owner has completed for this game. */
export function usePracticeProgress(gameId: string): { total: number; completed: string[] } {
  const owner = useRecordsOwner();
  const done = ownerMissions(usePracticeMissionsStore((state) => state.saved), owner);
  useEffect(() => {
    void usePracticeMissionsStore.getState().load();
  }, []);
  const missions = missionsFor(gameId);
  return { total: missions.length, completed: missions.filter((mission) => !!done[mission.id]).map((mission) => mission.id) };
}

/** Practice -> choose a goal or Free Practice (never forced). */
export function PracticePicker({ gameId, visible, onClose, onStart }: { gameId: string; visible: boolean; onClose: () => void; onStart: (missionId: string | null) => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { completed } = usePracticeProgress(gameId);
  const missions = missionsFor(gameId);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} accessibilityViewIsModal>
        <Text style={styles.title} accessibilityRole="header">
          {t('practiceAcademy.chooseGoal')}
        </Text>
        <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: spacing.xs }}>
          {missions.map((mission) => {
            const done = completed.includes(mission.id);
            return (
              <AnimatedPressable
                key={mission.id}
                style={styles.row}
                onPress={() => {
                  track('practice_mission_started', { game_id: gameId, mission_id: mission.id });
                  onStart(mission.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${t(mission.titleKey)}. ${t(mission.descriptionKey)}.${done ? ` ${t('practiceAcademy.goalCompleted')}.` : ''}`}
              >
                {done ? <CheckCircle2 size={18} color={colors.primary} strokeWidth={2.25} /> : <Circle size={18} color={colors.textMuted} strokeWidth={2} />}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.rowTitle}>{t(mission.titleKey)}</Text>
                  <Text style={styles.meta}>{t(mission.descriptionKey)}</Text>
                </View>
              </AnimatedPressable>
            );
          })}
        </ScrollView>
        <Button label={t('practiceAcademy.freePractice')} variant="secondary" icon={<Target size={16} color={colors.primary} strokeWidth={2} />} onPress={() => onStart(null)} />
      </View>
    </Modal>
  );
}

/** Small Game Detail card: "Practice goals 2 / 3 completed" + reset. */
export function PracticeProgressCard({ gameId }: { gameId: string }) {
  const { t } = useTranslation();
  const owner = useRecordsOwner();
  const { total, completed } = usePracticeProgress(gameId);
  if (total === 0) return null;
  return (
    <View style={styles.card} accessible={false}>
      <View style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={`${t('practiceAcademy.practiceGoals')}. ${t('practiceAcademy.completedCount', { done: completed.length, total })}`}>
        <Text style={styles.rowTitle}>{t('practiceAcademy.practiceGoals')}</Text>
        <Text style={styles.meta}>{t('practiceAcademy.completedCount', { done: completed.length, total })}</Text>
      </View>
      {completed.length > 0 ? <Button label={t('practiceAcademy.reset')} variant="text" onPress={() => usePracticeMissionsStore.getState().reset(owner)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: spacing.sm, padding: spacing.lg, borderTopLeftRadius: cardRadii.hero, borderTopRightRadius: cardRadii.hero, backgroundColor: colors.background },
  title: { ...typography.h2, color: colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, minHeight: 56, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  rowTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
});
