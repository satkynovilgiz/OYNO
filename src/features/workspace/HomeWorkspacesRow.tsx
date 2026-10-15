import { router } from 'expo-router';
import { Briefcase, ChevronRight } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, TextButton } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { ownerWorkspaces, useWorkspaceStore } from '@/store/useWorkspaceStore';
import { cardRadii, colors, headings, iconSizes, spacing, text } from '@/theme';

import { WORKSPACES_ROUTE, workspaceRoute } from './openWorkspace';
import { projectKey, recentWorkspaces } from './workspaceModel';

export const HOME_WORKSPACES = 3;

/**
 * Home: back to the current owner's most recently opened project
 * workspaces. Shows nothing until there is one (and nothing while loading
 * or after a failed load - Home never blocks on it; the list screen shows
 * the error). Titles are the last-seen project titles; the workspace
 * itself reads the live record.
 */
export function HomeWorkspacesRow() {
  const { t } = useTranslation();
  const owner = useRecordsOwner();
  const status = useWorkspaceStore((state) => state.status);
  const saved = useWorkspaceStore((state) => state.saved);
  useEffect(() => {
    void useWorkspaceStore.getState().load();
  }, []);
  if (status !== 'ready') return null;
  const recent = recentWorkspaces(ownerWorkspaces(saved, owner)).slice(0, HOME_WORKSPACES);
  if (recent.length === 0) return null;
  return (
    <View style={styles.root} testID="home-workspaces">
      <View style={styles.headerRow}>
        <Text style={styles.heading} accessibilityRole="header">
          {t('workspace.homeTitle')}
        </Text>
        <TextButton label={t('workspace.homeAll')} onPress={() => router.push(WORKSPACES_ROUTE as never)} testID="home-workspaces-all" />
      </View>
      {recent.map((entry) => {
        const name = entry.titleSnapshot || t(`shelf.untitled.${entry.type}`);
        return (
          <AnimatedPressable
            key={projectKey(entry)}
            style={styles.item}
            onPress={() => router.push(workspaceRoute(entry) as never)}
            press="soft"
            accessibilityRole="button"
            accessibilityLabel={`${name}. ${t(`shelf.types.${entry.type}`)}`}
            testID={`home-workspace-${projectKey(entry)}`}
          >
            <Briefcase size={iconSizes.md} color={colors.primary} strokeWidth={2} />
            <View style={styles.flex}>
              <Text style={styles.label} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.meta}>{t(`shelf.types.${entry.type}`)}</Text>
            </View>
            <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heading: { ...headings.label, color: colors.textSecondary, flexShrink: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: cardRadii.compact,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  flex: { flex: 1 },
  label: { ...text.emphasis, color: colors.textPrimary },
  meta: { ...text.fine, color: colors.textSecondary },
});
